/**
 * FX rate persistence helpers using the Prisma FxRate model.
 *
 * Direction: base_currency = USD, quote_currency = transaction currency.
 * Rate meaning: 1 USD = rate quote_currency.
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export interface CachedRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: Prisma.Decimal;
  rateDate: Date;
  source: string;
  createdAt: Date;
}

/**
 * Get the cached rate for a currency on a specific date.
 */
export async function getCachedRate(
  quoteCurrency: string,
  date: Date
): Promise<CachedRate | null> {
  return prisma.fxRate.findUnique({
    where: {
      baseCurrency_quoteCurrency_rateDate: {
        baseCurrency: "USD",
        quoteCurrency: quoteCurrency.toUpperCase(),
        rateDate: date,
      },
    },
  });
}

/**
 * Get all cached rates for a currency in a date range (inclusive).
 */
export async function getCachedRates(
  quoteCurrency: string,
  startDate: Date,
  endDate: Date
): Promise<CachedRate[]> {
  return prisma.fxRate.findMany({
    where: {
      baseCurrency: "USD",
      quoteCurrency: quoteCurrency.toUpperCase(),
      rateDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { rateDate: "asc" },
  });
}

/**
 * Insert or update an FX rate.
 */
export async function upsertRate(
  quoteCurrency: string,
  rate: number,
  rateDate: Date,
  source: string = "dim_forex"
): Promise<CachedRate> {
  return prisma.fxRate.upsert({
    where: {
      baseCurrency_quoteCurrency_rateDate: {
        baseCurrency: "USD",
        quoteCurrency: quoteCurrency.toUpperCase(),
        rateDate,
      },
    },
    create: {
      baseCurrency: "USD",
      quoteCurrency: quoteCurrency.toUpperCase(),
      rate: new Prisma.Decimal(rate),
      rateDate,
      source,
    },
    update: {
      rate: new Prisma.Decimal(rate),
      source,
    },
  });
}

/**
 * Get the latest rate at or before a given date (latest-prior-rate lookup).
 */
export async function getLatestPriorRate(
  quoteCurrency: string,
  date: Date
): Promise<CachedRate | null> {
  return prisma.fxRate.findFirst({
    where: {
      baseCurrency: "USD",
      quoteCurrency: quoteCurrency.toUpperCase(),
      rateDate: {
        lte: date,
      },
    },
    orderBy: { rateDate: "desc" },
  });
}
