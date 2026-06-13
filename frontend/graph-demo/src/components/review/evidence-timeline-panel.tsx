"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import {
  ArrowDownLeft,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  User,
  Network,
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
  timestamp: string | null;
}

interface Transaction {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  amount: number;
  currency: string;
  counterpartyName: string | null;
  status: string | null;
  paymentTime: string | null;
  createTime: string;
}

interface TransactionSummary {
  totalCount: number;
  dateRange: { earliest: string | null; latest: string | null };
}

interface GraphNode {
  custId: string;
  riskLevel: string;
  isHighRisk: boolean;
  isSanctioned: boolean;
}

interface GraphEdge {
  edgeType: string;
  neighborCustId: string;
  strength: string;
}

interface GraphData {
  custId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ReviewSnapshot {
  id: string;
  snapshotType: string;
  note: string | null;
  createdAt: string;
}

interface TimelineEvent {
  timestamp: string;
  type: "registration" | "profile_update" | "risk_signal" | "transaction" | "graph_association" | "review_decision";
  description: string;
  source: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function eventTypeIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "registration":
      return <User className="h-4 w-4 text-blue-500 shrink-0" />;
    case "profile_update":
      return <FileText className="h-4 w-4 text-purple-500 shrink-0" />;
    case "risk_signal":
      return <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />;
    case "transaction":
      return <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0" />;
    case "graph_association":
      return <Network className="h-4 w-4 text-cyan-500 shrink-0" />;
    case "review_decision":
      return <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function eventTypeBadge(type: TimelineEvent["type"]): string {
  switch (type) {
    case "registration":
      return "Registration";
    case "profile_update":
      return "Profile";
    case "risk_signal":
      return "Risk";
    case "transaction":
      return "Transaction";
    case "graph_association":
      return "Graph";
    case "review_decision":
      return "Decision";
    default:
      return type;
  }
}

function severityVariant(severity?: string): "default" | "destructive" | "secondary" | "outline" {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    case "low":
    case "info":
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// Event assembly
// ---------------------------------------------------------------------------

function assembleTimelineEvents(params: {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactions: Transaction[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
  reviewHistory: ReviewSnapshot[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { profile, riskSignals, transactions, graphData, reviewHistory } = params;

  // Registration event
  if (profile?.regTime) {
    events.push({
      timestamp: profile.regTime,
      type: "registration",
      description: `Customer registered as ${profile.custType} (${profile.custId})`,
      source: "Customer Profile",
    });
  }

  // Profile update events
  if (profile?.freshness.mainTable.lastUpdateTime) {
    events.push({
      timestamp: profile.freshness.mainTable.lastUpdateTime,
      type: "profile_update",
      description: "Main profile record updated",
      source: "cust_customer_info",
    });
  }
  if (profile?.freshness.realnameTable.lastUpdateTime) {
    events.push({
      timestamp: profile.freshness.realnameTable.lastUpdateTime,
      type: "profile_update",
      description: "Identity verification record updated",
      source: profile.custType === "COMPANY" ? "cust_enterprise_realname_info" : "cust_person_realname_info",
    });
  }

  // Risk signal events
  for (const signal of riskSignals) {
    if (signal.timestamp) {
      events.push({
        timestamp: signal.timestamp,
        type: "risk_signal",
        description: `${signal.label}: ${signal.value}`,
        source: signal.source,
        severity: signal.severity.toLowerCase() as TimelineEvent["severity"],
      });
    }
  }

  // Transaction events (sample up to 10 most recent)
  const recentTransactions = [...transactions]
    .sort((a, b) => (b.paymentTime ?? b.createTime).localeCompare(a.paymentTime ?? a.createTime))
    .slice(0, 10);

  for (const txn of recentTransactions) {
    const timestamp = txn.paymentTime ?? txn.createTime;
    const direction = txn.direction === "INBOUND" ? "Received" : "Sent";
    events.push({
      timestamp,
      type: "transaction",
      description: `${direction} ${txn.amount} ${txn.currency} ${txn.counterpartyName ? `from/to ${txn.counterpartyName}` : ""}`,
      source: txn.direction === "INBOUND" ? "pmp_coll_order" : "pmp_pay_order",
      severity: txn.status === "FAILED" || txn.status === "REJECTED" ? "medium" : "info",
    });
  }

  // Graph association events (neighbor count)
  if (graphData && graphData.edges.length > 0) {
    const highRiskNeighbors = graphData.nodes.filter(
      (n) => n.custId !== profile?.custId && (n.isHighRisk || n.isSanctioned)
    );
    const now = new Date().toISOString();
    events.push({
      timestamp: now,
      type: "graph_association",
      description: `${graphData.edges.length} associations detected (${graphData.edges.filter((e) => e.strength === "Strong").length} strong)${highRiskNeighbors.length > 0 ? `, ${highRiskNeighbors.length} high-risk neighbors` : ""}`,
      source: "Risk Graph",
      severity: highRiskNeighbors.length > 0 ? "high" : "info",
    });
  }

  // Review decision events
  for (const snapshot of reviewHistory) {
    events.push({
      timestamp: snapshot.createdAt,
      type: "review_decision",
      description: `${snapshot.snapshotType} snapshot${snapshot.note ? `: ${snapshot.note}` : ""}`,
      source: "Review History",
    });
  }

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EvidenceTimelinePanelProps {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactions: Transaction[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
  reviewHistory: ReviewSnapshot[];
}

export function EvidenceTimelinePanel({
  profile,
  riskSignals,
  transactions,
  transactionSummary,
  graphData,
  reviewHistory,
}: EvidenceTimelinePanelProps) {
  const events = useMemo(
    () =>
      assembleTimelineEvents({
        profile,
        riskSignals,
        transactions,
        transactionSummary,
        graphData,
        reviewHistory,
      }),
    [profile, riskSignals, transactions, transactionSummary, graphData, reviewHistory]
  );

  return (
    <WorkbenchPanel
      title="Evidence Timeline"
      empty={events.length === 0}
      emptyMessage="No evidence events assembled. Fetch customer data to populate the timeline."
    >
      <TimelineContent events={events} />
    </WorkbenchPanel>
  );
}

function TimelineContent({ events }: { events: TimelineEvent[] }) {
  // Group events by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const dateKey = formatDate(event.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    }
    return groups;
  }, [events]);

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{events.length} event{events.length !== 1 ? "s" : ""} across {dateKeys.length} date{dateKeys.length !== 1 ? "s" : ""}</span>
      </div>

      <Separator />

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {dateKeys.map((dateKey) => (
          <div key={dateKey} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {dateKey}
              </span>
            </div>

            <div className="ml-4 space-y-2 border-l-2 border-muted pl-4">
              {groupedByDate[dateKey].map((event, idx) => (
                <div
                  key={`${event.timestamp}-${idx}`}
                  className="flex items-start gap-3 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors"
                >
                  {eventTypeIcon(event.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={severityVariant(event.severity)} className="text-xs">
                        {eventTypeBadge(event.type)}
                      </Badge>
                      {event.severity && event.severity !== "info" && (
                        <Badge variant={severityVariant(event.severity)} className="text-xs">
                          {event.severity.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-0.5 break-words">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatDateTime(event.timestamp)}</span>
                      <span className="text-muted-foreground/50">|</span>
                      <span>{event.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {events.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <CheckCircle className="h-4 w-4" />
            <span>No events to display.</span>
          </div>
        )}
      </div>
    </div>
  );
}
