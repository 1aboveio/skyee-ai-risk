"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkbenchPanel } from "./workbench-panel";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror API response)
// ---------------------------------------------------------------------------

interface Transaction {
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

interface TransactionListResult {
  transactions: Transaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency?: string): string {
  return new Intl.NumberFormat("en-US", {
    style: currency ? "currency" : "decimal",
    currency: currency ?? "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString();
}

function statusBadgeVariant(
  status: string | null
): "default" | "destructive" | "secondary" | "outline" {
  if (!status) return "outline";
  switch (status.toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
    case "SETTLED":
      return "default";
    case "FAILED":
    case "REJECTED":
      return "destructive";
    case "PENDING":
    case "PROCESSING":
      return "secondary";
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionListPanelProps {
  custId: string;
}

export function TransactionListPanel({ custId }: TransactionListPanelProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const nextCursorRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("limit", "20");

        const response = await fetch(
          `/api/review/${custId}/transactions?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const data = (await response.json()) as TransactionListResult;
        if (!cancelled) {
          setTransactions(data.transactions);
          nextCursorRef.current = data.nextCursor;
          setHasMore(data.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [custId]);

  const handleLoadMore = async () => {
    if (!nextCursorRef.current || loadingMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("cursor", nextCursorRef.current);
      params.set("limit", "20");

      const response = await fetch(
        `/api/review/${custId}/transactions?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = (await response.json()) as TransactionListResult;
      setTransactions((prev) => [...prev, ...data.transactions]);
      nextCursorRef.current = data.nextCursor;
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <WorkbenchPanel
      title="Transaction List"
      loading={loading}
      error={error}
      empty={transactions.length === 0 && !loading}
      emptyMessage="No transactions found for this customer."
    >
      <div className="space-y-4">
        <TransactionTable transactions={transactions} />

        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Load More
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </WorkbenchPanel>
  );
}

function TransactionTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2 font-medium">Date</th>
            <th className="text-left p-2 font-medium">Direction</th>
            <th className="text-left p-2 font-medium">Counterparty</th>
            <th className="text-right p-2 font-medium">Amount</th>
            <th className="text-right p-2 font-medium">USD Amount</th>
            <th className="text-left p-2 font-medium">Status</th>
            <th className="text-left p-2 font-medium">FX Warning</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr
              key={txn.id}
              className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <td className="p-2 whitespace-nowrap">
                {formatDate(txn.paymentTime ?? txn.createTime)}
              </td>
              <td className="p-2">
                <div className="flex items-center gap-1">
                  {txn.direction === "INBOUND" ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={
                      txn.direction === "INBOUND"
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {txn.direction}
                  </span>
                </div>
              </td>
              <td className="p-2 max-w-[200px] truncate">
                {txn.counterpartyName ?? "N/A"}
              </td>
              <td className="text-right p-2 font-mono whitespace-nowrap">
                {formatCurrency(txn.amount, txn.currency)}
              </td>
              <td className="text-right p-2 font-mono whitespace-nowrap">
                {txn.usdAmount !== null
                  ? formatCurrency(txn.usdAmount, "USD")
                  : "N/A"}
              </td>
              <td className="p-2">
                {txn.status ? (
                  <Badge variant={statusBadgeVariant(txn.status)}>
                    {txn.status}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-2">
                {txn.fxWarning ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-destructive"
                    title={txn.fxWarning}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span className="max-w-[100px] truncate">Warning</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
