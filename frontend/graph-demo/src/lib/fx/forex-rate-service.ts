/**
 * ForexRateService — converts transaction amounts to USD for review evidence.
 *
 * ADR 0004 contract:
 * - Direction: base_currency = USD, quote_currency = transaction currency
 * - Rate meaning: 1 USD = rate quote_currency
 * - Latest-prior-rate lookup (at or before requested date)
 * - Warning (not error) when no prior rate exists
 * - Lazy backfill from dim_forex via Presto when rate is missing
 */

import { Prisma } from "@/generated/prisma/client";
import {
  getCachedRate,
  getLatestPriorRate,
  upsertRate,
  type CachedRate,
} from "./store";
import { queryDimForex } from "@/lib/evidence/presto";

export interface FxRateResult {
  /** The exchange rate: 1 USD = rate quote_currency */
  rate: number;
  /** The date of the rate actually used */
  rateDate: Date;
  /** Where the rate came from */
  source: string;
  /** Data-quality warning if present */
  warning?: string;
}

export interface ConversionResult {
  /** The converted USD amount */
  usdAmount: number;
  /** The exchange rate used */
  rate: number;
  /** The date of the rate used */
  rateDate: Date;
  /** Where the rate came from */
  source: string;
  /** Data-quality warning if present */
  warning?: string;
}

const MAX_BACKFILL_DAYS = 365;

export class ForexRateService {
  /**
   * Get rate for currency/date. Uses latest-prior-rate lookup.
   * Tries cache first, then lazy-backfills from dim_forex.
   */
  async getRate(quoteCurrency: string, date: Date): Promise<FxRateResult> {
    const normalizedCurrency = quoteCurrency.toUpperCase();

    // USD to USD is always 1
    if (normalizedCurrency === "USD") {
      return {
        rate: 1,
        rateDate: date,
        source: "identity",
      };
    }

    // 1. Try exact date cache
    let cached = await getCachedRate(normalizedCurrency, date);
    if (cached) {
      return this.rateResultFromCache(cached);
    }

    // 2. Try latest-prior-rate from cache
    cached = await getLatestPriorRate(normalizedCurrency, date);
    if (cached) {
      return this.rateResultFromCache(cached, date);
    }

    // 3. Lazy backfill from dim_forex
    const backfilled = await this.tryBackfill(normalizedCurrency, date);
    if (backfilled) {
      return backfilled;
    }

    // 4. No rate found — return warning, not error
    return {
      rate: 0,
      rateDate: date,
      source: "missing",
      warning: `No exchange rate found for ${normalizedCurrency} on or before ${this.formatDate(date)}. USD conversion cannot be performed.`,
    };
  }

  /**
   * Convert amount to USD.
   */
  async convertToUsd(
    amount: number,
    currency: string,
    date: Date
  ): Promise<ConversionResult> {
    const rateResult = await this.getRate(currency, date);

    if (rateResult.rate === 0) {
      return {
        usdAmount: 0,
        rate: 0,
        rateDate: rateResult.rateDate,
        source: rateResult.source,
        warning: rateResult.warning,
      };
    }

    // rate means 1 USD = rate quote_currency
    // So to convert quote_currency to USD: amount / rate
    const usdAmount = amount / rateResult.rate;

    return {
      usdAmount,
      rate: rateResult.rate,
      rateDate: rateResult.rateDate,
      source: rateResult.source,
      warning: rateResult.warning,
    };
  }

  /**
   * Backfill missing rates from dim_forex (warehouse) via Presto.
   * Returns the number of rates inserted.
   */
  async backfillRates(
    currency: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const normalizedCurrency = currency.toUpperCase();

    // Limit backfill range to prevent runaway queries
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > MAX_BACKFILL_DAYS) {
      throw new Error(
        `Backfill range exceeds ${MAX_BACKFILL_DAYS} days. Use smaller batches.`
      );
    }

    const rows = await queryDimForex(
      normalizedCurrency,
      this.formatDate(startDate),
      this.formatDate(endDate)
    );

    let inserted = 0;
    for (const row of rows) {
      // Parse as UTC to avoid timezone drift
      const rateDate = new Date(row.rate_date + "T00:00:00Z");
      const rate = parseFloat(row.exchange_rate);

      if (isNaN(rate)) continue;

      await upsertRate(normalizedCurrency, rate, rateDate, "dim_forex");
      inserted++;
    }

    return inserted;
  }

  /**
   * Try to backfill from dim_forex for the requested date, then re-check cache.
   */
  private async tryBackfill(
    currency: string,
    date: Date
): Promise<FxRateResult | null> {
    // Backfill a window ending at the requested date (UTC arithmetic)
    const startDate = new Date(date.getTime() - MAX_BACKFILL_DAYS * 24 * 60 * 60 * 1000);

    try {
      const rows = await queryDimForex(
        currency,
        this.formatDate(startDate),
        this.formatDate(date)
      );

      if (rows.length === 0) return null;

      // Upsert all returned rates
      for (const row of rows) {
        // Parse as UTC to avoid timezone drift
        const rateDate = new Date(row.rate_date + "T00:00:00Z");
        const rate = parseFloat(row.exchange_rate);
        if (isNaN(rate)) continue;
        await upsertRate(currency, rate, rateDate, "dim_forex");
      }

      // Re-check for latest prior rate after backfill
      const cached = await getLatestPriorRate(currency, date);
      if (cached) {
        return this.rateResultFromCache(cached, date);
      }

      return null;
    } catch (error) {
      // Backfill failure is non-fatal — log and return null
      console.warn(
        `FX backfill failed for ${currency} around ${this.formatDate(date)}:`,
        error
      );
      return null;
    }
  }

  private rateResultFromCache(
    cached: CachedRate,
    requestedDate?: Date
  ): FxRateResult {
    const rate = cached.rate instanceof Prisma.Decimal
      ? cached.rate.toNumber()
      : Number(cached.rate);

    const result: FxRateResult = {
      rate,
      rateDate: cached.rateDate,
      source: cached.source,
    };

    // Add warning if the rate date is earlier than requested
    if (requestedDate && cached.rateDate < requestedDate) {
      result.warning = `No rate available for ${this.formatDate(requestedDate)}. Using rate from ${this.formatDate(cached.rateDate)} instead.`;
    }

    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
