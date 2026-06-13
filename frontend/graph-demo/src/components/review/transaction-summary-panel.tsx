"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Hash,
  TrendingUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror API response)
// ---------------------------------------------------------------------------

interface TransactionSummary {
  totalCount: number;
  totalAmount: number;
  currencyBreakdown: Record<string, { count: number; amount: number }>;
  dateRange: { earliest: string | null; latest: string | null };
  directionBreakdown: { inbound: number; outbound: number };
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionSummaryPanelProps {
  custId: string;
}

export function TransactionSummaryPanel({ custId }: TransactionSummaryPanelProps) {
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/review/${custId}/transactions/summary`);
        if (!response.ok) {
          throw new Error("Failed to fetch transaction summary");
        }

        const data = (await response.json()) as TransactionSummary;
        if (!cancelled) {
          setSummary(data);
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

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [custId]);

  return (
    <WorkbenchPanel
      title="Transaction Summary"
      loading={loading}
      error={error}
      empty={!summary && !loading}
      emptyMessage="No transaction data found for this customer."
    >
      {summary && <SummaryContent summary={summary} />}
    </WorkbenchPanel>
  );
}

function SummaryContent({ summary }: { summary: TransactionSummary }) {
  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Hash className="h-4 w-4 text-muted-foreground" />}
          label="Total Count"
          value={summary.totalCount.toString()}
        />
        <MetricCard
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          label="Total Amount"
          value={formatCurrency(summary.totalAmount)}
        />
        <MetricCard
          icon={<ArrowDownLeft className="h-4 w-4 text-green-600" />}
          label="Inbound"
          value={summary.directionBreakdown.inbound.toString()}
        />
        <MetricCard
          icon={<ArrowUpRight className="h-4 w-4 text-red-600" />}
          label="Outbound"
          value={summary.directionBreakdown.outbound.toString()}
        />
      </div>

      <Separator />

      {/* Date range */}
      <div className="flex items-center gap-2 text-sm">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Date Range:</span>
        <span>
          {formatDate(summary.dateRange.earliest)} -{" "}
          {formatDate(summary.dateRange.latest)}
        </span>
      </div>

      <Separator />

      {/* Currency breakdown */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Currency Breakdown
        </h4>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">Currency</th>
                <th className="text-right p-2 font-medium">Count</th>
                <th className="text-right p-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.currencyBreakdown)
                .sort(([, a], [, b]) => b.amount - a.amount)
                .map(([currency, data]) => (
                  <tr key={currency} className="border-b last:border-b-0">
                    <td className="p-2">
                      <Badge variant="outline">{currency}</Badge>
                    </td>
                    <td className="text-right p-2">{data.count}</td>
                    <td className="text-right p-2 font-mono">
                      {formatCurrency(data.amount, currency)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
