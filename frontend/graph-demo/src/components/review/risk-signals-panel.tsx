"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  Info,
  Clock,
  Database,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (mirror API response)
// ---------------------------------------------------------------------------

type SignalSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface RiskSignal {
  signalType: string;
  label: string;
  value: string;
  severity: SignalSeverity;
  source: string;
  timestamp: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadgeVariant(severity: SignalSeverity): "default" | "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "CRITICAL":
      return "destructive";
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "secondary";
    case "LOW":
      return "outline";
    case "INFO":
    default:
      return "outline";
  }
}

function severityIcon(severity: SignalSeverity) {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />;
    case "MEDIUM":
      return <Shield className="h-4 w-4 text-muted-foreground shrink-0" />;
    case "LOW":
    case "INFO":
    default:
      return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RiskSignalsPanelProps {
  custId: string;
}

export function RiskSignalsPanel({ custId }: RiskSignalsPanelProps) {
  const [signals, setSignals] = useState<RiskSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignals() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/review/${custId}/risk-signals`);
        if (!response.ok) {
          throw new Error("Failed to fetch risk signals");
        }

        const data = (await response.json()) as RiskSignal[];
        if (!cancelled) {
          setSignals(data);
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

    fetchSignals();
    return () => {
      cancelled = true;
    };
  }, [custId]);

  return (
    <WorkbenchPanel
      title="Risk Signals"
      loading={loading}
      error={error}
      empty={signals.length === 0 && !loading}
      emptyMessage="No risk signals found for this customer."
    >
      <SignalsContent signals={signals} />
    </WorkbenchPanel>
  );
}

function SignalsContent({ signals }: { signals: RiskSignal[] }) {
  // Sort by severity (critical first)
  const sorted = [...signals].sort((a, b) => {
    const order: Record<SignalSeverity, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      INFO: 4,
    };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {sorted.length} signal{sorted.length !== 1 ? "s" : ""} found
        </span>
        {sorted.some((s) => s.severity === "CRITICAL" || s.severity === "HIGH") && (
          <Badge variant="destructive" className="text-xs">
            Requires attention
          </Badge>
        )}
      </div>

      <Separator />

      {/* Signal list */}
      <div className="space-y-2">
        {sorted.map((signal) => (
          <div
            key={signal.signalType}
            className="flex items-start gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
          >
            {severityIcon(signal.severity)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{signal.label}</span>
                <Badge
                  variant={severityBadgeVariant(signal.severity)}
                  className="text-xs"
                >
                  {signal.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 break-words">
                {signal.value}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {signal.source}
                </span>
                {signal.timestamp && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(signal.timestamp)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* All clear state */}
      {sorted.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <CheckCircle className="h-4 w-4" />
          <span>No risk signals detected.</span>
        </div>
      )}
    </div>
  );
}
