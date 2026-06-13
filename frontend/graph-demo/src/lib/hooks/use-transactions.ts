"use client";

import useSWRInfinite from "swr/infinite";
import { useCallback, useMemo } from "react";

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
// Fetcher
// ---------------------------------------------------------------------------

const fetcher = async (url: string): Promise<TransactionListResult> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }
  return response.json();
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTransactions(custId: string, filters: TransactionFilters = {}) {
  const getKey = useCallback(
    (pageIndex: number, previousPageData: TransactionListResult | null) => {
      // Reached the end
      if (previousPageData && !previousPageData.hasMore) return null;

      // Build URL with filters
      const params = new URLSearchParams();
      params.set("limit", "20");

      if (pageIndex === 0) {
        // First page - no cursor
      } else if (previousPageData?.nextCursor) {
        params.set("cursor", previousPageData.nextCursor);
      } else {
        return null;
      }

      // Add filters
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.direction) params.set("direction", filters.direction);
      if (filters.minUsdAmount !== undefined)
        params.set("minUsdAmount", String(filters.minUsdAmount));
      if (filters.maxUsdAmount !== undefined)
        params.set("maxUsdAmount", String(filters.maxUsdAmount));

      return `/api/review/${custId}/transactions?${params.toString()}`;
    },
    [custId, filters]
  );

  const {
    data,
    error,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<TransactionListResult>(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const transactions = useMemo(
    () => data?.flatMap((page) => page.transactions) ?? [],
    [data]
  );

  const isLoading = !data && !error;
  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");
  const isEmpty = data?.[0]?.transactions.length === 0;
  const hasMore = data ? data[data.length - 1]?.hasMore ?? false : false;

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setSize((prev) => prev + 1);
    }
  }, [isLoadingMore, hasMore, setSize]);

  return {
    transactions,
    isLoading,
    isLoadingMore,
    error: error?.message ?? null,
    isEmpty,
    hasMore,
    loadMore,
    mutate,
  };
}
