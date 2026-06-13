"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { WorkbenchPanel } from "./workbench-panel";
import type { CustomerProfile } from "@/lib/evidence/customer-profile";
import {
  Database,
  FileText,
  Hash,
  Info,
  Network,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskSignal {
  signalType: string;
  label: string;
  value: string;
  severity: string;
  source: string;
}

interface TransactionSummary {
  totalCount: number;
  currencyBreakdown: Record<string, { count: number; amount: number }>;
  dateRange: { earliest: string | null; latest: string | null };
  directionBreakdown: { inbound: number; outbound: number };
}

interface GraphNode {
  custId: string;
  custName?: string | null;
  riskLevel: string;
  isHighRisk: boolean;
  isSanctioned: boolean;
}

interface GraphEdge {
  edgeType: string;
  neighborCustId: string;
  strength: string;
  edgeValue?: string | null;
}

interface GraphData {
  custId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    strongEdgeCount: number;
    weakEdgeCount: number;
    highRiskCount: number;
  };
  source: string;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface NormalizedEvidence {
  customerFacts: Record<string, string>;
  riskIndicators: string[];
  transactionProfile: Record<string, string>;
  graphAssociations: {
    totalNodes: number;
    totalEdges: number;
    strongEdges: number;
    weakEdges: number;
    highRiskNeighbors: string[];
    edgeTypes: Record<string, number>;
  };
  dataFreshness: {
    profileLastUpdated: string | null;
    hasRecentTransactions: boolean;
    hasRiskSignals: boolean;
    hasGraphData: boolean;
  };
}

function normalizeEvidence(params: {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
}): NormalizedEvidence {
  const { profile, riskSignals, transactionSummary, graphData } = params;

  // Customer facts
  const customerFacts: Record<string, string> = {};
  if (profile) {
    customerFacts["Customer ID"] = profile.custId;
    customerFacts["Type"] = profile.custType;
    if (profile.custName) customerFacts["Name"] = profile.custName;
    if (profile.enName) customerFacts["English Name"] = profile.enName;
    if (profile.custStatus) customerFacts["Status"] = profile.custStatus;
    if (profile.registCountry) customerFacts["Country"] = profile.registCountry;
    if (profile.realnameStatus) customerFacts["KYC Status"] = profile.realnameStatus;
    if (profile.personal) {
      if (profile.personal.certType) customerFacts["ID Type"] = profile.personal.certType;
      if (profile.personal.certNo) customerFacts["ID Number (masked)"] = `${profile.personal.certNo.slice(0, 3)}***${profile.personal.certNo.slice(-3)}`;
    }
    if (profile.enterprise) {
      if (profile.enterprise.legalPersonName) customerFacts["Legal Person"] = profile.enterprise.legalPersonName;
      if (profile.enterprise.businessStatus) customerFacts["Business Status"] = profile.enterprise.businessStatus;
    }
  }

  // Risk indicators
  const riskIndicators: string[] = [];
  if (profile) {
    if (profile.riskLevel) riskIndicators.push(`Risk Level: ${profile.riskLevel}`);
    if (profile.riskScore !== null) riskIndicators.push(`Risk Score: ${profile.riskScore}`);
    if (profile.highRisk) riskIndicators.push("Flagged as HIGH RISK");
    if (profile.sanctioned) riskIndicators.push("SANCTIONED");
  }
  for (const signal of riskSignals) {
    if (signal.signalType !== "RISK_LEVEL" && signal.signalType !== "RISK_SCORE") {
      riskIndicators.push(`${signal.label}: ${signal.value}`);
    }
  }

  // Transaction profile
  const transactionProfile: Record<string, string> = {};
  if (transactionSummary) {
    transactionProfile["Total Transactions"] = transactionSummary.totalCount.toString();
    transactionProfile["Inbound Count"] = transactionSummary.directionBreakdown.inbound.toString();
    transactionProfile["Outbound Count"] = transactionSummary.directionBreakdown.outbound.toString();
    if (transactionSummary.dateRange.earliest) {
      transactionProfile["First Transaction"] = new Date(transactionSummary.dateRange.earliest).toLocaleDateString();
    }
    if (transactionSummary.dateRange.latest) {
      transactionProfile["Last Transaction"] = new Date(transactionSummary.dateRange.latest).toLocaleDateString();
    }
    const currencies = Object.keys(transactionSummary.currencyBreakdown);
    if (currencies.length > 0) {
      transactionProfile["Currencies"] = currencies.join(", ");
    }
    for (const [currency, data] of Object.entries(transactionSummary.currencyBreakdown)) {
      transactionProfile[`Volume (${currency})`] = `${data.count} txns, ${data.amount.toFixed(2)}`;
    }
  }

  // Graph associations
  const graphAssociations = {
    totalNodes: graphData?.nodes.length ?? 0,
    totalEdges: graphData?.edges.length ?? 0,
    strongEdges: graphData?.edges.filter((e) => e.strength === "Strong").length ?? 0,
    weakEdges: graphData?.edges.filter((e) => e.strength !== "Strong").length ?? 0,
    highRiskNeighbors: graphData?.nodes
      .filter((n) => n.custId !== graphData.custId && (n.isHighRisk || n.isSanctioned))
      .map((n) => n.custId) ?? [],
    edgeTypes: graphData?.edges.reduce((acc, edge) => {
      acc[edge.edgeType] = (acc[edge.edgeType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>) ?? {},
  };

  // Data freshness
  const dataFreshness = {
    profileLastUpdated: profile?.freshness.mainTable.lastUpdateTime ?? null,
    hasRecentTransactions: (transactionSummary?.totalCount ?? 0) > 0,
    hasRiskSignals: riskSignals.length > 0,
    hasGraphData: (graphData?.edges.length ?? 0) > 0,
  };

  return {
    customerFacts,
    riskIndicators,
    transactionProfile,
    graphAssociations,
    dataFreshness,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AiInvestigationInputPanelProps {
  profile: CustomerProfile | null;
  riskSignals: RiskSignal[];
  transactionSummary: TransactionSummary | null;
  graphData: GraphData | null;
}

export function AiInvestigationInputPanel({
  profile,
  riskSignals,
  transactionSummary,
  graphData,
}: AiInvestigationInputPanelProps) {
  const evidence = useMemo(
    () =>
      normalizeEvidence({
        profile,
        riskSignals,
        transactionSummary,
        graphData,
      }),
    [profile, riskSignals, transactionSummary, graphData]
  );

  const hasAnyData =
    Object.keys(evidence.customerFacts).length > 0 ||
    evidence.riskIndicators.length > 0 ||
    Object.keys(evidence.transactionProfile).length > 0 ||
    evidence.graphAssociations.totalEdges > 0;

  return (
    <WorkbenchPanel
      title="AI Investigation Input"
      empty={!hasAnyData}
      emptyMessage="Normalized evidence will appear here once customer data is loaded."
    >
      <InvestigationInputContent evidence={evidence} />
    </WorkbenchPanel>
  );
}

function InvestigationInputContent({
  evidence,
}: {
  evidence: NormalizedEvidence;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>Structured evidence for AI consumption. No recommendations generated.</span>
      </div>

      <Separator />

      {/* Customer Facts */}
      {Object.keys(evidence.customerFacts).length > 0 && (
        <Section title="Customer Facts" icon={<FileText className="h-4 w-4" />}>
          <FactTable facts={evidence.customerFacts} />
        </Section>
      )}

      {/* Risk Indicators */}
      {evidence.riskIndicators.length > 0 && (
        <Section title="Risk Indicators" icon={<Shield className="h-4 w-4" />}>
          <ul className="space-y-1">
            {evidence.riskIndicators.map((indicator, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground">-</span>
                <span>{indicator}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Transaction Profile */}
      {Object.keys(evidence.transactionProfile).length > 0 && (
        <Section title="Transaction Profile" icon={<Database className="h-4 w-4" />}>
          <FactTable facts={evidence.transactionProfile} />
        </Section>
      )}

      {/* Graph Associations */}
      {evidence.graphAssociations.totalEdges > 0 && (
        <Section title="Graph Associations" icon={<Network className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="flex justify-between p-2 rounded border">
              <span className="text-muted-foreground">Nodes</span>
              <span className="font-medium">{evidence.graphAssociations.totalNodes}</span>
            </div>
            <div className="flex justify-between p-2 rounded border">
              <span className="text-muted-foreground">Edges</span>
              <span className="font-medium">{evidence.graphAssociations.totalEdges}</span>
            </div>
            <div className="flex justify-between p-2 rounded border">
              <span className="text-muted-foreground">Strong</span>
              <span className="font-medium">{evidence.graphAssociations.strongEdges}</span>
            </div>
            <div className="flex justify-between p-2 rounded border">
              <span className="text-muted-foreground">Weak</span>
              <span className="font-medium">{evidence.graphAssociations.weakEdges}</span>
            </div>
          </div>

          {evidence.graphAssociations.highRiskNeighbors.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">High-Risk Neighbors:</span>
              <div className="flex flex-wrap gap-1">
                {evidence.graphAssociations.highRiskNeighbors.map((id) => (
                  <Badge key={id} variant="destructive" className="text-xs font-mono">
                    {id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {Object.keys(evidence.graphAssociations.edgeTypes).length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-xs text-muted-foreground">Edge Types:</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(evidence.graphAssociations.edgeTypes).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Data Freshness */}
      <Section title="Data Freshness" icon={<Hash className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 p-2 rounded border">
            <div className={`h-2 w-2 rounded-full ${evidence.dataFreshness.profileLastUpdated ? "bg-green-500" : "bg-muted-foreground"}`} />
            <span className="text-muted-foreground">Profile</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded border">
            <div className={`h-2 w-2 rounded-full ${evidence.dataFreshness.hasRecentTransactions ? "bg-green-500" : "bg-muted-foreground"}`} />
            <span className="text-muted-foreground">Transactions</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded border">
            <div className={`h-2 w-2 rounded-full ${evidence.dataFreshness.hasRiskSignals ? "bg-green-500" : "bg-muted-foreground"}`} />
            <span className="text-muted-foreground">Risk Signals</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded border">
            <div className={`h-2 w-2 rounded-full ${evidence.dataFreshness.hasGraphData ? "bg-green-500" : "bg-muted-foreground"}`} />
            <span className="text-muted-foreground">Graph Data</span>
          </div>
        </div>
        {evidence.dataFreshness.profileLastUpdated && (
          <p className="text-xs text-muted-foreground mt-2">
            Profile last updated: {new Date(evidence.dataFreshness.profileLastUpdated).toLocaleString()}
          </p>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function FactTable({ facts }: { facts: Record<string, string> }) {
  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(facts).map(([key, value], idx) => (
            <tr key={key} className={idx > 0 ? "border-t" : ""}>
              <td className="p-2 text-muted-foreground whitespace-nowrap">{key}</td>
              <td className="p-2 font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
