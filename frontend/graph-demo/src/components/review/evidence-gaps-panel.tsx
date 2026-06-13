"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import {
  AlertTriangle,
  CheckCircle,
  Database,
  FileText,
  Info,
  Network,
  Shield,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerProfile {
  custId: string;
  custType: string;
  custName: string | null;
  custStatus: string | null;
  realnameStatus: string | null;
  riskLevel: string | null;
  highRisk: boolean;
  sanctioned: boolean;
  regTime: string | null;
  freshness: {
    mainTable: { createTime: string | null; lastUpdateTime: string | null };
    realnameTable: { createTime: string | null; lastUpdateTime: string | null };
  };
}

interface RiskSignal {
  signalType: string;
  label: string;
  value: string;
  severity: string;
  source: string;
}

interface TransactionSummary {
  totalCount: number;
  dateRange: { earliest: string | null; latest: string | null };
}

interface GraphData {
  nodes: unknown[];
  edges: unknown[];
}

interface ReviewSnapshot {
  id: string;
  snapshotType: string;
}

type EvidenceStatus = "present" | "partial" | "missing";

interface EvidenceGap {
  category: string;
  status: EvidenceStatus;
  icon: React.ReactNode;
  description: string;
  details?: string[];
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function analyzeEvidenceGaps(params: {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
  reviewHistory: ReviewSnapshot[];
}): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  const { profile, riskSignals, transactionSummary, graphData, reviewHistory } = params;

  // 1. Customer Profile
  if (!profile) {
    gaps.push({
      category: "Customer Profile",
      status: "missing",
      icon: <FileText className="h-4 w-4 text-destructive shrink-0" />,
      description: "No customer profile found",
      details: ["Customer ID not found in cust_customer_info table"],
    });
  } else {
    const profileDetails: string[] = [];
    if (!profile.custName) profileDetails.push("Customer name is missing");
    if (!profile.custStatus) profileDetails.push("Customer status is unknown");
    if (!profile.realnameStatus || profile.realnameStatus === "UNVERIFIED") {
      profileDetails.push("KYC verification incomplete or missing");
    }
    if (!profile.regTime) profileDetails.push("Registration date not recorded");

    gaps.push({
      category: "Customer Profile",
      status: profileDetails.length === 0 ? "present" : "partial",
      icon: <FileText className={`h-4 w-4 shrink-0 ${profileDetails.length === 0 ? "text-green-500" : "text-yellow-500"}`} />,
      description: profileDetails.length === 0
        ? `Profile complete (${profile.custType})`
        : `Profile has ${profileDetails.length} gap${profileDetails.length !== 1 ? "s" : ""}`,
      details: profileDetails.length > 0 ? profileDetails : undefined,
    });
  }

  // 2. Risk Signals
  if (riskSignals.length === 0) {
    gaps.push({
      category: "Risk Signals",
      status: "missing",
      icon: <Shield className="h-4 w-4 text-destructive shrink-0" />,
      description: "No risk signals available",
      details: ["No risk level, risk score, or risk flags found in customer data"],
    });
  } else {
    const hasRiskLevel = riskSignals.some((s) => s.signalType === "RISK_LEVEL");
    const hasRiskScore = riskSignals.some((s) => s.signalType === "RISK_SCORE");
    const signalDetails: string[] = [];
    if (!hasRiskLevel) signalDetails.push("Risk level not assigned");
    if (!hasRiskScore) signalDetails.push("Risk score not calculated");

    gaps.push({
      category: "Risk Signals",
      status: signalDetails.length === 0 ? "present" : "partial",
      icon: <Shield className={`h-4 w-4 shrink-0 ${signalDetails.length === 0 ? "text-green-500" : "text-yellow-500"}`} />,
      description: `${riskSignals.length} signal${riskSignals.length !== 1 ? "s" : ""} found`,
      details: signalDetails.length > 0 ? signalDetails : undefined,
    });
  }

  // 3. Transactions
  if (!transactionSummary || transactionSummary.totalCount === 0) {
    gaps.push({
      category: "Transactions",
      status: "missing",
      icon: <Database className="h-4 w-4 text-destructive shrink-0" />,
      description: "No transaction data available",
      details: ["No payment or collection orders found for this customer"],
    });
  } else {
    const txnDetails: string[] = [];
    const now = new Date();
    if (transactionSummary.dateRange.latest) {
      const latestDate = new Date(transactionSummary.dateRange.latest);
      const daysSinceLatest = Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLatest > 90) {
        txnDetails.push(`No transaction data for last ${daysSinceLatest} days`);
      }
    }
    if (transactionSummary.totalCount < 5) {
      txnDetails.push(`Limited transaction history (${transactionSummary.totalCount} records)`);
    }

    gaps.push({
      category: "Transactions",
      status: txnDetails.length === 0 ? "present" : "partial",
      icon: <Database className={`h-4 w-4 shrink-0 ${txnDetails.length === 0 ? "text-green-500" : "text-yellow-500"}`} />,
      description: `${transactionSummary.totalCount} transaction${transactionSummary.totalCount !== 1 ? "s" : ""} found`,
      details: txnDetails.length > 0 ? txnDetails : undefined,
    });
  }

  // 4. Risk Graph
  if (!graphData) {
    gaps.push({
      category: "Risk Graph",
      status: "missing",
      icon: <Network className="h-4 w-4 text-destructive shrink-0" />,
      description: "No graph association data",
      details: ["Risk graph analysis not performed or no associations found"],
    });
  } else {
    const graphDetails: string[] = [];
    if (graphData.edges.length === 0) {
      graphDetails.push("No associations detected");
    }
    if (graphData.nodes.length <= 1) {
      graphDetails.push("No neighbor nodes found");
    }

    gaps.push({
      category: "Risk Graph",
      status: graphDetails.length === 0 ? "present" : "partial",
      icon: <Network className={`h-4 w-4 shrink-0 ${graphDetails.length === 0 ? "text-green-500" : "text-yellow-500"}`} />,
      description: graphDetails.length === 0
        ? `${graphData.nodes.length} nodes, ${graphData.edges.length} edges mapped`
        : `Graph data limited`,
      details: graphDetails.length > 0 ? graphDetails : undefined,
    });
  }

  // 5. Decisions
  if (reviewHistory.length === 0) {
    gaps.push({
      category: "Decisions",
      status: "missing",
      icon: <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />,
      description: "No review decisions recorded",
      details: ["No previous review sessions or decisions found"],
    });
  } else {
    gaps.push({
      category: "Decisions",
      status: "present",
      icon: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
      description: `${reviewHistory.length} review snapshot${reviewHistory.length !== 1 ? "s" : ""} recorded`,
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeVariant(status: EvidenceStatus): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "present":
      return "default";
    case "partial":
      return "secondary";
    case "missing":
      return "destructive";
    default:
      return "outline";
  }
}

function statusIcon(status: EvidenceStatus) {
  switch (status) {
    case "present":
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case "partial":
      return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
    case "missing":
      return <XCircle className="h-3 w-3 text-destructive" />;
    default:
      return <Info className="h-3 w-3 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EvidenceGapsPanelProps {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
  reviewHistory: ReviewSnapshot[];
}

export function EvidenceGapsPanel({
  profile,
  riskSignals,
  transactionSummary,
  graphData,
  reviewHistory,
}: EvidenceGapsPanelProps) {
  const gaps = useMemo(
    () =>
      analyzeEvidenceGaps({
        profile,
        riskSignals,
        transactionSummary,
        graphData,
        reviewHistory,
      }),
    [profile, riskSignals, transactionSummary, graphData, reviewHistory]
  );

  const presentCount = gaps.filter((g) => g.status === "present").length;
  const missingCount = gaps.filter((g) => g.status === "missing").length;
  const partialCount = gaps.filter((g) => g.status === "partial").length;

  return (
    <WorkbenchPanel
      title="Evidence Gaps"
      empty={gaps.length === 0}
      emptyMessage="No evidence categories analyzed yet."
    >
      <GapsContent
        gaps={gaps}
        presentCount={presentCount}
        missingCount={missingCount}
        partialCount={partialCount}
      />
    </WorkbenchPanel>
  );
}

function GapsContent({
  gaps,
  presentCount,
  missingCount,
  partialCount,
}: {
  gaps: EvidenceGap[];
  presentCount: number;
  missingCount: number;
  partialCount: number;
}) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>{presentCount} complete</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>{partialCount} partial</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-4 w-4 text-destructive" />
          <span>{missingCount} missing</span>
        </div>
      </div>

      <Separator />

      {/* Gap list */}
      <div className="space-y-3">
        {gaps.map((gap) => (
          <div
            key={gap.category}
            className="p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {gap.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{gap.category}</span>
                    <Badge variant={statusBadgeVariant(gap.status)} className="text-xs">
                      {gap.status.toUpperCase()}
                    </Badge>
                  </div>
                  {statusIcon(gap.status)}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{gap.description}</p>
                {gap.details && gap.details.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {gap.details.map((detail, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-muted-foreground/50 mt-0.5">-</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall assessment */}
      {missingCount > 0 && (
        <>
          <Separator />
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span>
              {missingCount} evidence categor{missingCount !== 1 ? "ies are" : "y is"} missing.
              Review may be incomplete without full evidence.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
