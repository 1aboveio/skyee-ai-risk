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
  totalAmount: number;
  currencyBreakdown: Record<string, { count: number; amount: number }>;
  dateRange: { earliest: string | null; latest: string | null };
  directionBreakdown: { inbound: number; outbound: number };
}

export interface TransactionListResult {
  transactions: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
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

interface PayDetailsRow extends mysql.RowDataPacket {
  ID: string;
  PAY_ORDER_ID: string;
  CUST_ID: string;
  PAY_TXN_AMT: number | string | null;
  CURRENCY_CD: string | null;
  PAYMENT_TIME: Date | string | null;
  SUBJECT_NAME: string | null;
  BANK_NAME: string | null;
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const MAX_CUST_ID_LENGTH = 64;

export async function getTransactionSummary(
  custId: string
): Promise<TransactionSummary> {
  if (custId.length > MAX_CUST_ID_LENGTH) {
    throw new Error("Customer ID too long.");
  }

  // Fetch all transactions for summary (server-side only)
  const [payOrders, payDetails, collOrders] = await Promise.all([
    query<PayOrderRow[]>(
      `SELECT PAY_ORDER_ID, CUST_ID, ORDER_NO, SETTLE_AMT, SETTLE_CURR_CD,
              PAYMENT_STATUS, PAYMENT_TIME, NAME, CREATE_TIME
       FROM pmp_pay_order
       WHERE CUST_ID = ?`,
      [custId]
    ),
    query<PayDetailsRow[]>(
      `SELECT ID, PAY_ORDER_ID, CUST_ID, PAY_TXN_AMT, CURRENCY_CD,
              PAYMENT_TIME, SUBJECT_NAME, BANK_NAME, CREATE_TIME
       FROM pmp_pay_details
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
  let totalAmount = 0;
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
    totalAmount += amount;
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

  // Process outbound payments from pay_details
  for (const row of payDetails) {
    const amount = toNumber(row.PAY_TXN_AMT);
    const currency = row.CURRENCY_CD?.toUpperCase() ?? "UNKNOWN";
    const createTime = formatDate(row.CREATE_TIME) ?? "";

    totalCount++;
    totalAmount += amount;
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
    totalAmount += amount;
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
    totalAmount,
    currencyBreakdown,
    dateRange: { earliest, latest },
    directionBreakdown: { inbound, outbound },
  };
}

export async function getTransactionList(
  custId: string,
  cursor?: string,
  limit: number = PAGE_SIZE
): Promise<TransactionListResult> {
  if (custId.length > MAX_CUST_ID_LENGTH) {
    throw new Error("Customer ID too long.");
  }

  const forexService = new ForexRateService();
  const effectiveLimit = Math.min(limit, 100); // Cap at 100

  // Parse cursor: "createTime|id" format
  let cursorCreateTime: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const parts = cursor.split("|");
    if (parts.length === 2) {
      cursorCreateTime = parts[0];
      cursorId = parts[1];
    }
  }

  // Fetch all raw transactions
  const [payOrders, payDetails, collOrders] = await Promise.all([
    query<PayOrderRow[]>(
      `SELECT PAY_ORDER_ID, CUST_ID, ORDER_NO, SETTLE_AMT, SETTLE_CURR_CD,
              PAYMENT_STATUS, PAYMENT_TIME, NAME, CREATE_TIME
       FROM pmp_pay_order
       WHERE CUST_ID = ?`,
      [custId]
    ),
    query<PayDetailsRow[]>(
      `SELECT ID, PAY_ORDER_ID, CUST_ID, PAY_TXN_AMT, CURRENCY_CD,
              PAYMENT_TIME, SUBJECT_NAME, BANK_NAME, CREATE_TIME
       FROM pmp_pay_details
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

  // Normalize into Transaction[]
  const allTransactions: Transaction[] = [];

  for (const row of payOrders) {
    const amount = toNumber(row.SETTLE_AMT);
    const currency = row.SETTLE_CURR_CD?.toUpperCase() ?? "UNKNOWN";
    const paymentTime = formatDate(row.PAYMENT_TIME);
    const createTime = formatDate(row.CREATE_TIME) ?? new Date().toISOString();
    const paymentDate = row.PAYMENT_TIME ? new Date(row.PAYMENT_TIME) : new Date(row.CREATE_TIME);

    // Get FX conversion
    const fxResult = await forexService.convertToUsd(amount, currency, paymentDate);

    allTransactions.push({
      id: row.PAY_ORDER_ID,
      custId: row.CUST_ID,
      orderNo: row.ORDER_NO,
      direction: "OUTBOUND",
      amount,
      currency,
      usdAmount: fxResult.usdAmount,
      fxRate: fxResult.rate,
      fxRateDate: formatDate(fxResult.rateDate),
      fxWarning: fxResult.warning ?? null,
      counterpartyName: row.NAME,
      counterpartyBank: null,
      status: row.PAYMENT_STATUS,
      paymentTime,
      createTime,
    });
  }

  for (const row of payDetails) {
    const amount = toNumber(row.PAY_TXN_AMT);
    const currency = row.CURRENCY_CD?.toUpperCase() ?? "UNKNOWN";
    const paymentTime = formatDate(row.PAYMENT_TIME);
    const createTime = formatDate(row.CREATE_TIME) ?? new Date().toISOString();
    const paymentDate = row.PAYMENT_TIME ? new Date(row.PAYMENT_TIME) : new Date(row.CREATE_TIME);

    // Get FX conversion
    const fxResult = await forexService.convertToUsd(amount, currency, paymentDate);

    allTransactions.push({
      id: row.ID,
      custId: row.CUST_ID,
      orderNo: row.PAY_ORDER_ID,
      direction: "OUTBOUND",
      amount,
      currency,
      usdAmount: fxResult.usdAmount,
      fxRate: fxResult.rate,
      fxRateDate: formatDate(fxResult.rateDate),
      fxWarning: fxResult.warning ?? null,
      counterpartyName: row.SUBJECT_NAME,
      counterpartyBank: row.BANK_NAME,
      status: null,
      paymentTime,
      createTime,
    });
  }

  for (const row of collOrders) {
    const amount = toNumber(row.COLL_TXN_AMT);
    const currency = row.COLL_CURRENCY_CD?.toUpperCase() ?? "UNKNOWN";
    const paymentTime = formatDate(row.ARRIVAL_TIME);
    const createTime = formatDate(row.CREATE_TIME) ?? new Date().toISOString();
    const paymentDate = row.ARRIVAL_TIME ? new Date(row.ARRIVAL_TIME) : new Date(row.CREATE_TIME);

    // Get FX conversion
    const fxResult = await forexService.convertToUsd(amount, currency, paymentDate);

    allTransactions.push({
      id: row.COLL_ORDER_ID,
      custId: row.CUST_ID,
      orderNo: null,
      direction: "INBOUND",
      amount,
      currency,
      usdAmount: fxResult.usdAmount,
      fxRate: fxResult.rate,
      fxRateDate: formatDate(fxResult.rateDate),
      fxWarning: fxResult.warning ?? null,
      counterpartyName: row.NAME,
      counterpartyBank: null,
      status: row.COLL_STATUS,
      paymentTime,
      createTime,
    });
  }

  // Sort newest first
  allTransactions.sort((a, b) => {
    const timeCompare = b.createTime.localeCompare(a.createTime);
    if (timeCompare !== 0) return timeCompare;
    return b.id.localeCompare(a.id);
  });

  // Apply cursor-based pagination
  let startIndex = 0;
  if (cursorCreateTime && cursorId) {
    startIndex = allTransactions.findIndex(
      (t) => t.createTime === cursorCreateTime && t.id === cursorId
    );
    if (startIndex >= 0) {
      startIndex++; // Start after the cursor
    } else {
      startIndex = 0; // Cursor not found, start from beginning
    }
  }

  const paginatedTransactions = allTransactions.slice(startIndex, startIndex + effectiveLimit);
  const hasMore = startIndex + effectiveLimit < allTransactions.length;
  const nextCursor = hasMore && paginatedTransactions.length > 0
    ? `${paginatedTransactions[paginatedTransactions.length - 1].createTime}|${paginatedTransactions[paginatedTransactions.length - 1].id}`
    : null;

  return {
    transactions: paginatedTransactions,
    nextCursor,
    hasMore,
  };
}
