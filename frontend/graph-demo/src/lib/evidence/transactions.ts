import { query } from "./mysql";
import { ForexRateService } from "@/lib/fx/forex-rate-service";
import type mysql from "mysql2/promise";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  custId: string;
  orderNo: string | null;
  direction: "INBOUND" | "OUTBOUND";
  amount: number;
  currency: string;
  usdAmount: number | null;
  fxRate: number | null;
  fxRateDate: string | null;
  fxWarning: string | null;
  counterpartyName: string | null;
  counterpartyBank: string | null;
  status: string | null;
  paymentTime: string | null;
  createTime: string;
}

export interface TransactionSummary {
  totalCount: number;
  currencyBreakdown: Record<string, { count: number; amount: number }>;
  dateRange: { earliest: string | null; latest: string | null };
  directionBreakdown: { inbound: number; outbound: number };
}

export interface TransactionListResult {
  transactions: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  direction?: "INBOUND" | "OUTBOUND";
  minUsdAmount?: number;
  maxUsdAmount?: number;
}

// ---------------------------------------------------------------------------
// MySQL row types
// ---------------------------------------------------------------------------

interface PayOrderRow extends mysql.RowDataPacket {
  PAY_ORDER_ID: string;
  CUST_ID: string;
  ORDER_NO: string | null;
  SETTLE_AMT: number | string | null;
  SETTLE_CURR_CD: string | null;
  PAYMENT_STATUS: string | null;
  PAYMENT_TIME: Date | string | null;
  NAME: string | null;
  CREATE_TIME: Date | string;
}

interface CollOrderRow extends mysql.RowDataPacket {
  COLL_ORDER_ID: string;
  CUST_ID: string;
  COLL_TXN_AMT: number | string | null;
  COLL_CURRENCY_CD: string | null;
  COLL_STATUS: string | null;
  ARRIVAL_TIME: Date | string | null;
  NAME: string | null;
  CREATE_TIME: Date | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

interface CursorPayload {
  createTime: string;
  id: string;
}

function encodeCursor(createTime: string, id: string): string {
  const payload: CursorPayload = { createTime, id };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (typeof parsed.createTime === "string" && typeof parsed.id === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const MAX_CUST_ID_LENGTH = 64;
// When USD amount filters are active, we must over-fetch from the database
// because we can only apply USD filters after FX conversion (in-memory).
const USD_FILTER_OVERFETCH_MULTIPLIER = 5;

export async function getTransactionSummary(
  custId: string
): Promise<TransactionSummary> {
  if (custId.length > MAX_CUST_ID_LENGTH) {
    throw new Error("Customer ID too long.");
  }

  // Fetch transactions using authoritative tables only:
  // - pmp_pay_order for outbound (header level)
  // - pmp_coll_order for inbound
  // No pmp_pay_details — those are line items and would double-count.
  const [payOrders, collOrders] = await Promise.all([
    query<PayOrderRow[]>(
      `SELECT PAY_ORDER_ID, CUST_ID, ORDER_NO, SETTLE_AMT, SETTLE_CURR_CD,
              PAYMENT_STATUS, PAYMENT_TIME, NAME, CREATE_TIME
       FROM pmp_pay_order
       WHERE CUST_ID = ?`,
      [custId]
    ),
    query<CollOrderRow[]>(
      `SELECT COLL_ORDER_ID, CUST_ID, COLL_TXN_AMT, COLL_CURRENCY_CD,
              COLL_STATUS, ARRIVAL_TIME, NAME, CREATE_TIME
       FROM pmp_coll_order
       WHERE CUST_ID = ?`,
      [custId]
    ),
  ]);

  const currencyBreakdown: Record<string, { count: number; amount: number }> = {};
  let totalCount = 0;
  let inbound = 0;
  let outbound = 0;
  let earliest: string | null = null;
  let latest: string | null = null;

  // Process outbound payments from pay_orders
  for (const row of payOrders) {
    const amount = toNumber(row.SETTLE_AMT);
    const currency = row.SETTLE_CURR_CD?.toUpperCase() ?? "UNKNOWN";
    const createTime = formatDate(row.CREATE_TIME) ?? "";

    totalCount++;
    outbound++;

    if (!currencyBreakdown[currency]) {
      currencyBreakdown[currency] = { count: 0, amount: 0 };
    }
    currencyBreakdown[currency].count++;
    currencyBreakdown[currency].amount += amount;

    if (createTime) {
      if (!earliest || createTime < earliest) earliest = createTime;
      if (!latest || createTime > latest) latest = createTime;
    }
  }

  // Process inbound collections
  for (const row of collOrders) {
    const amount = toNumber(row.COLL_TXN_AMT);
    const currency = row.COLL_CURRENCY_CD?.toUpperCase() ?? "UNKNOWN";
    const createTime = formatDate(row.CREATE_TIME) ?? "";

    totalCount++;
    inbound++;

    if (!currencyBreakdown[currency]) {
      currencyBreakdown[currency] = { count: 0, amount: 0 };
    }
    currencyBreakdown[currency].count++;
    currencyBreakdown[currency].amount += amount;

    if (createTime) {
      if (!earliest || createTime < earliest) earliest = createTime;
      if (!latest || createTime > latest) latest = createTime;
    }
  }

  return {
    totalCount,
    currencyBreakdown,
    dateRange: { earliest, latest },
    directionBreakdown: { inbound, outbound },
  };
}

export async function getTransactionList(
  custId: string,
  cursor?: string,
  limit: number = PAGE_SIZE,
  filters?: TransactionFilters
): Promise<TransactionListResult> {
  if (custId.length > MAX_CUST_ID_LENGTH) {
    throw new Error("Customer ID too long.");
  }

  const forexService = new ForexRateService();
  const effectiveLimit = Math.min(limit, 100); // Cap at 100

  // When USD amount filters are active, over-fetch to compensate for
  // post-pagination filtering (FX conversion happens in-memory).
  const hasUsdFilters = filters?.minUsdAmount !== undefined || filters?.maxUsdAmount !== undefined;
  const dbFetchLimit = hasUsdFilters
    ? effectiveLimit * USD_FILTER_OVERFETCH_MULTIPLIER
    : effectiveLimit;

  // Parse cursor using base64-encoded JSON
  let cursorCreateTime: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      cursorCreateTime = decoded.createTime;
      cursorId = decoded.id;
    }
  }

  // Fetch with proper SQL cursor-based pagination.
  // Keyset: (CREATE_TIME, PAY_ORDER_ID) < (cursorCreateTime, cursorId) for DESC order.
  // We fetch effectiveLimit + 1 rows from each table to detect hasMore, then merge.

  const hasCursor = cursorCreateTime !== null && cursorId !== null;
  const fetchLimit = dbFetchLimit + 1;

  // Build date filter conditions
  const dateFilter: string[] = [];
  const dateParams: string[] = [];
  if (filters?.startDate) {
    dateFilter.push(`CREATE_TIME >= ?`);
    dateParams.push(filters.startDate);
  }
  if (filters?.endDate) {
    dateFilter.push(`CREATE_TIME <= ?`);
    dateParams.push(filters.endDate);
  }
  const dateFilterClause = dateFilter.length > 0 ? `AND ${dateFilter.join(" AND ")}` : "";

  // Direction filter
  const skipPayOrders = filters?.direction === "INBOUND";
  const skipCollOrders = filters?.direction === "OUTBOUND";

  // Outbound from pmp_pay_order (authoritative header-level records)
  const payWhere = hasCursor
    ? `WHERE CUST_ID = ? AND (CREATE_TIME, PAY_ORDER_ID) < (?, ?) ${dateFilterClause}`
    : `WHERE CUST_ID = ? ${dateFilterClause}`;
  const payParams = hasCursor
    ? [custId, cursorCreateTime, cursorId, ...dateParams, fetchLimit]
    : [custId, ...dateParams, fetchLimit];

  // Inbound from pmp_coll_order
  const collWhere = hasCursor
    ? `WHERE CUST_ID = ? AND (CREATE_TIME, COLL_ORDER_ID) < (?, ?) ${dateFilterClause}`
    : `WHERE CUST_ID = ? ${dateFilterClause}`;
  const collParams = hasCursor
    ? [custId, cursorCreateTime, cursorId, ...dateParams, fetchLimit]
    : [custId, ...dateParams, fetchLimit];

  const [payOrders, collOrders] = await Promise.all([
    skipPayOrders
      ? Promise.resolve([] as PayOrderRow[])
      : query<PayOrderRow[]>(
          `SELECT PAY_ORDER_ID, CUST_ID, ORDER_NO, SETTLE_AMT, SETTLE_CURR_CD,
                  PAYMENT_STATUS, PAYMENT_TIME, NAME, CREATE_TIME
           FROM pmp_pay_order
           ${payWhere}
           ORDER BY CREATE_TIME DESC, PAY_ORDER_ID DESC
           LIMIT ?`,
          payParams
        ),
    skipCollOrders
      ? Promise.resolve([] as CollOrderRow[])
      : query<CollOrderRow[]>(
          `SELECT COLL_ORDER_ID, CUST_ID, COLL_TXN_AMT, COLL_CURRENCY_CD,
                  COLL_STATUS, ARRIVAL_TIME, NAME, CREATE_TIME
           FROM pmp_coll_order
           ${collWhere}
           ORDER BY CREATE_TIME DESC, COLL_ORDER_ID DESC
           LIMIT ?`,
          collParams
        ),
  ]);

  // Normalize into Transaction[]
  const payTransactions: Transaction[] = payOrders.map((row) => {
    const amount = toNumber(row.SETTLE_AMT);
    const currency = row.SETTLE_CURR_CD?.toUpperCase() ?? "UNKNOWN";
    const paymentTime = formatDate(row.PAYMENT_TIME);
    const createTime = formatDate(row.CREATE_TIME) ?? new Date().toISOString();

    return {
      id: row.PAY_ORDER_ID,
      custId: row.CUST_ID,
      orderNo: row.ORDER_NO,
      direction: "OUTBOUND" as const,
      amount,
      currency,
      usdAmount: null, // filled below
      fxRate: null,
      fxRateDate: null,
      fxWarning: null,
      counterpartyName: row.NAME,
      counterpartyBank: null,
      status: row.PAYMENT_STATUS,
      paymentTime,
      createTime,
    };
  });

  const collTransactions: Transaction[] = collOrders.map((row) => {
    const amount = toNumber(row.COLL_TXN_AMT);
    const currency = row.COLL_CURRENCY_CD?.toUpperCase() ?? "UNKNOWN";
    const paymentTime = formatDate(row.ARRIVAL_TIME);
    const createTime = formatDate(row.CREATE_TIME) ?? new Date().toISOString();

    return {
      id: row.COLL_ORDER_ID,
      custId: row.CUST_ID,
      orderNo: null,
      direction: "INBOUND" as const,
      amount,
      currency,
      usdAmount: null,
      fxRate: null,
      fxRateDate: null,
      fxWarning: null,
      counterpartyName: row.NAME,
      counterpartyBank: null,
      status: row.COLL_STATUS,
      paymentTime,
      createTime,
    };
  });

  // Merge and sort all candidates
  const allTransactions = [...payTransactions, ...collTransactions].sort(
    (a, b) => {
      const timeCompare = b.createTime.localeCompare(a.createTime);
      if (timeCompare !== 0) return timeCompare;
      return b.id.localeCompare(a.id);
    }
  );

  // Determine if there are more results
  const hasMore = allTransactions.length > dbFetchLimit;
  let pageTransactions = allTransactions.slice(0, dbFetchLimit);

  // Parallelize FX conversions for all fetched transactions
  const fxPromises = pageTransactions.map((txn) => {
    const date = txn.paymentTime
      ? new Date(txn.paymentTime)
      : new Date(txn.createTime);
    return forexService.convertToUsd(txn.amount, txn.currency, date);
  });

  const fxResults = await Promise.all(fxPromises);

  for (let i = 0; i < pageTransactions.length; i++) {
    const fx = fxResults[i];
    pageTransactions[i].usdAmount = fx.usdAmount;
    pageTransactions[i].fxRate = fx.rate;
    pageTransactions[i].fxRateDate = formatDate(fx.rateDate);
    pageTransactions[i].fxWarning = fx.warning ?? null;
  }

  // Apply USD amount filters (done after FX conversion since we can't
  // filter by USD amount in SQL — it requires FX conversion).
  if (hasUsdFilters) {
    pageTransactions = pageTransactions.filter((txn) => {
      const usdAmt = txn.usdAmount ?? 0;
      if (filters?.minUsdAmount !== undefined && usdAmt < filters.minUsdAmount) return false;
      if (filters?.maxUsdAmount !== undefined && usdAmt > filters.maxUsdAmount) return false;
      return true;
    });
    // Trim to the requested limit after filtering
    pageTransactions = pageTransactions.slice(0, effectiveLimit);
  }

  // Re-evaluate hasMore based on whether we got enough filtered results
  const effectiveHasMore = hasUsdFilters
    ? hasMore || pageTransactions.length === effectiveLimit
    : hasMore;

  // Build next cursor from last item
  const nextCursor =
    effectiveHasMore && pageTransactions.length > 0
      ? encodeCursor(
          pageTransactions[pageTransactions.length - 1].createTime,
          pageTransactions[pageTransactions.length - 1].id
        )
      : null;

  return {
    transactions: pageTransactions,
    nextCursor,
    hasMore: effectiveHasMore,
  };
}
