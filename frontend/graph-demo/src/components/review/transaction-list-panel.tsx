"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkbenchPanel } from "./workbench-panel";
import { TransactionFiltersBar, parseFiltersFromSearchParams } from "./transaction-filters";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import {
  useTransactions,
  type Transaction,
  type TransactionFilters,
} from "@/lib/hooks/use-transactions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency?: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: currency ? "currency" : "decimal",
      currency: currency ?? "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown/invalid currency codes
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
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
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TransactionFilters>(() =>
    parseFiltersFromSearchParams(searchParams)
  );

  const {
    transactions,
    isLoading,
    isLoadingMore,
    error,
    isEmpty,
    hasMore,
    loadMore,
  } = useTransactions(custId, filters);

  const handleFiltersChange = useCallback((newFilters: TransactionFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <WorkbenchPanel
      title="Transaction List"
      loading={isLoading}
      error={error}
      empty={isEmpty && !isLoading}
      emptyMessage="No transactions found for this customer."
    >
      <div className="space-y-4">
        <TransactionFiltersBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />

        <TransactionTable transactions={transactions} />

        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
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
