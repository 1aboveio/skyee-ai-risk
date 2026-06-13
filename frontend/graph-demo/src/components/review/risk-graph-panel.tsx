"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  DatabaseIcon,
  Link2Icon,
  NetworkIcon,
  RefreshCcwIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkbenchPanel } from "@/components/review/workbench-panel";
import {
  categorizeEdgeType,
  edgeCategoryLabel,
  edgeCategoryVariant,
  type EdgeCategory,
} from "@/lib/graph/edge-categories";
import type { GraphEdge, GraphNode, GraphSearchResult } from "@/lib/graph/schema";

type LoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: GraphSearchResult | null; error: null }
  | { status: "ready"; data: GraphSearchResult; error: null }
  | { status: "error"; data: GraphSearchResult | null; error: string };

function riskVariant(node: Pick<GraphNode, "riskLevel" | "isHighRisk" | "isSanctioned">) {
  if (node.isSanctioned || node.riskLevel === "HIGH") {
    return "destructive";
  }
  if (node.isHighRisk || node.riskLevel === "MEDIUM_HIGH") {
    return "secondary";
  }
  return "outline";
}

function displayName(node: GraphNode): string {
  return node.custName ?? `Customer ${node.custId}`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchGraph(custId: string, includeWeak: boolean): Promise<GraphSearchResult> {
  const params = new URLSearchParams({
    custId,
    includeWeak: String(includeWeak),
    limit: "15",
  });
  const response = await fetch(`/api/graph/search?${params.toString()}`);
  if (!response.ok) {
    try {
      const body = (await response.json()) as {
        error?: { message?: string; detail?: { node_degree?: number; max_degree?: number } };
      };
      const degree = body.error?.detail?.node_degree;
      const maxDegree = body.error?.detail?.max_degree;
      if (degree && maxDegree) {
        throw new Error(
          `${body.error?.message ?? "Graph query blocked"} Degree ${degree.toLocaleString()} exceeds interactive limit ${maxDegree.toLocaleString()}.`
        );
      }
      throw new Error(body.error?.message ?? `Search failed with status ${response.status}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Search failed with status ${response.status}`);
    }
  }
  return (await response.json()) as GraphSearchResult;
}

function GraphCanvas({ result }: { result: GraphSearchResult }) {
  const width = 760;
  const height = 440;
  const center = { x: width / 2, y: height / 2 };
  const neighbors = result.nodes.filter((node) => node.custId !== result.custId);
  const radius = Math.min(width, height) * 0.36;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(result.custId, center);
  neighbors.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(neighbors.length, 1) - Math.PI / 2;
    positions.set(node.custId, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/20">
      <svg
        role="img"
        aria-label="Customer relationship graph"
        viewBox={`0 0 ${width} ${height}`}
        className="aspect-[19/11] w-full"
      >
        <rect width={width} height={height} fill="var(--card)" />
        {result.edges.map((edge) => {
          const source = positions.get(result.custId) ?? center;
          const target = positions.get(edge.neighborCustId);
          if (!target) {
            return null;
          }
          return (
            <g key={edge.edgeId}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={edge.strength === "Strong" ? "var(--primary)" : "var(--chart-3)"}
                strokeDasharray={edge.strength === "Weak" ? "7 7" : undefined}
                strokeOpacity={0.75}
                strokeWidth={edge.strength === "Strong" ? 2.5 : 1.8}
              />
            </g>
          );
        })}
        {result.nodes.map((node) => {
          const point = positions.get(node.custId);
          if (!point) {
            return null;
          }
          const isCenter = node.custId === result.custId;
          const fill = node.isSanctioned
            ? "var(--destructive)"
            : node.isHighRisk
              ? "var(--chart-4)"
              : isCenter
                ? "var(--primary)"
                : "var(--secondary)";
          return (
            <g key={node.custId}>
              <title>{`${node.custId} ${displayName(node)} ${node.riskLevel}`}</title>
              <circle
                cx={point.x}
                cy={point.y}
                r={isCenter ? 34 : 25}
                fill={fill}
                stroke="var(--background)"
                strokeWidth="5"
              />
              <text
                x={point.x}
                y={point.y + 4}
                textAnchor="middle"
                className={
                  isCenter || node.isHighRisk ? "fill-primary-foreground" : "fill-foreground"
                }
                style={{ fontSize: "13px", fontWeight: 600 }}
              >
                {node.custId.slice(-4)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: typeof UsersIcon;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
        <CardAction>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function NodeRow({ node, isCenter }: { node: GraphNode; isCenter: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{node.custId}</span>
          {isCenter && (
            <Badge variant="outline" className="text-[10px]">
              Root
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{displayName(node)}</div>
      </div>
      <Badge variant={riskVariant(node)} className="shrink-0">
        {node.isSanctioned ? "SANCTIONED" : node.riskLevel}
      </Badge>
    </div>
  );
}

function EdgeRow({ edge, node }: { edge: GraphEdge; node: GraphNode | null }) {
  const category = categorizeEdgeType(edge.edgeType);
  return (
    <TableRow>
      <TableCell className="py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{edge.edgeType}</span>
          <Badge variant={edgeCategoryVariant(category)} className="text-[10px]">
            {edgeCategoryLabel(category)}
          </Badge>
        </div>
        {edge.edgeValue && (
          <div className="truncate text-xs text-muted-foreground max-w-48">
            {edge.edgeValue}
          </div>
        )}
      </TableCell>
      <TableCell className="py-2">
        <div className="flex flex-col">
          <span className="text-sm">{edge.neighborCustId}</span>
          {node && (
            <span className="text-xs text-muted-foreground truncate">{displayName(node)}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2">
        <Badge variant={edge.strength === "Strong" ? "default" : "outline"}>
          {edge.strength === "Strong" ? "Strong" : "Weak"}
        </Badge>
      </TableCell>
      <TableCell className="py-2">
        {node ? <Badge variant={riskVariant(node)}>{node.riskLevel}</Badge> : "-"}
      </TableCell>
      <TableCell className="py-2 text-xs text-muted-foreground">
        {edge.lastSeen ? formatDateTime(edge.lastSeen) : "-"}
      </TableCell>
    </TableRow>
  );
}

function HighRiskPanel({ result }: { result: GraphSearchResult }) {
  const highRiskNodes = result.nodes.filter(
    (node) => node.custId !== result.custId && (node.isHighRisk || node.isSanctioned)
  );

  if (highRiskNodes.length === 0) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs text-muted-foreground">High-Risk Neighbors</CardTitle>
          <CardAction>
            <ShieldAlertIcon className="h-4 w-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No high-risk neighbors found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">High-Risk Neighbors</CardTitle>
        <CardAction>
          <ShieldAlertIcon className="h-4 w-4 text-destructive" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {highRiskNodes.map((node) => (
            <div key={node.custId} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{displayName(node)}</div>
                <div className="text-xs text-muted-foreground">{node.custId}</div>
              </div>
              <Badge variant={riskVariant(node)} className="shrink-0">
                {node.isSanctioned ? "SANCTIONED" : node.riskLevel}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CategorySummary({ edges }: { edges: GraphEdge[] }) {
  const categories = useMemo(() => {
    const counts: Record<EdgeCategory, number> = {
      "shared-attribute": 0,
      "transaction-flow": 0,
      unknown: 0,
    };
    for (const edge of edges) {
      counts[categorizeEdgeType(edge.edgeType)]++;
    }
    return counts;
  }, [edges]);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-xs text-muted-foreground">Edge Categories</CardTitle>
        <CardAction>
          <NetworkIcon className="h-4 w-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {(Object.entries(categories) as [EdgeCategory, number][])
            .filter(([, count]) => count > 0)
            .map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <Badge variant={edgeCategoryVariant(category)}>{edgeCategoryLabel(category)}</Badge>
                <span className="text-sm tabular-nums font-medium">{count}</span>
              </div>
            ))}
        </div>
        <Separator className="my-3" />
        <div className="text-xs text-muted-foreground">
          {categories["transaction-flow"] > 0
            ? "Includes transaction counterparties"
            : "All edges are shared-attribute relationships"}
        </div>
      </CardContent>
    </Card>
  );
}

interface RiskGraphPanelProps {
  custId: string;
  includeWeak?: boolean;
  onEvidenceUpdate?: (data: GraphSearchResult | null) => void;
}

export function RiskGraphPanel({
  custId,
  includeWeak = true,
  onEvidenceUpdate,
}: RiskGraphPanelProps) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    data: null,
    error: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setState((current) => ({ status: "loading", data: current.data, error: null }));
    setRefreshKey((k) => k + 1);
  }, []);

  // Fetch graph data when custId, includeWeak, or refreshKey changes.
  // Only .then/.catch call setState (not the effect body itself).
  useEffect(() => {
    const controller = new AbortController();

    fetchGraph(custId, includeWeak)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", data, error: null });
          onEvidenceUpdate?.(data);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          const errorMessage = error instanceof Error ? error.message : "Search failed";
          setState((current) => ({
            status: "error",
            data: current.data,
            error: errorMessage,
          }));
          onEvidenceUpdate?.(null);
        }
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshKey is intentional trigger
  }, [custId, includeWeak, refreshKey]);

  const result = state.data;
  const isLoading = state.status === "loading";
  const nodeById = useMemo(
    () => (result ? new Map(result.nodes.map((node) => [node.custId, node])) : new Map()),
    [result]
  );

  if (state.status === "error" && !result) {
    return (
      <WorkbenchPanel title="Risk Graph" error={state.error}>
        <div />
      </WorkbenchPanel>
    );
  }

  if (!result) {
    return (
      <WorkbenchPanel title="Risk Graph" loading={isLoading} empty={!isLoading} emptyMessage="Graph associations will be loaded here.">
        <div />
      </WorkbenchPanel>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">Risk Graph</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {result.nodes.length} nodes
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {result.edges.length} edges
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" className="text-[10px]" />}>
                <DatabaseIcon className="h-3 w-3 mr-1 inline" />
                {result.source}
              </TooltipTrigger>
              <TooltipContent>Data source</TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "error" && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Graph Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-5 gap-2">
          <MetricCard title="Nodes" value={result.stats.nodeCount} icon={UsersIcon} />
          <MetricCard title="Edges" value={result.stats.edgeCount} icon={NetworkIcon} />
          <MetricCard title="Strong" value={result.stats.strongEdgeCount} icon={Link2Icon} />
          <MetricCard title="Weak" value={result.stats.weakEdgeCount} icon={Link2Icon} />
          <MetricCard title="High Risk" value={result.stats.highRiskCount} icon={ShieldAlertIcon} />
        </div>

        {/* Main visualization */}
        <Tabs defaultValue="graph" className="gap-3">
          <TabsList>
            <TabsTrigger value="graph">Graph</TabsTrigger>
            <TabsTrigger value="table">Edges</TabsTrigger>
            <TabsTrigger value="nodes">Nodes</TabsTrigger>
          </TabsList>
          <TabsContent value="graph">
            <GraphCanvas result={result} />
          </TabsContent>
          <TabsContent value="table">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link Type</TableHead>
                    <TableHead>Neighbor</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.edges.map((edge) => (
                    <EdgeRow
                      key={edge.edgeId}
                      edge={edge}
                      node={nodeById.get(edge.neighborCustId) ?? null}
                    />
                  ))}
                  {result.edges.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        No edges found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="nodes">
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {result.nodes
                .sort((a, b) => {
                  if (a.custId === result.custId) return -1;
                  if (b.custId === result.custId) return 1;
                  const riskOrder = { HIGH: 0, MEDIUM_HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
                  return (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
                })
                .map((node) => (
                  <NodeRow
                    key={node.custId}
                    node={node}
                    isCenter={node.custId === result.custId}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Sidebar panels */}
        <div className="grid grid-cols-2 gap-3">
          <HighRiskPanel result={result} />
          <CategorySummary edges={result.edges} />
        </div>

        {/* Metadata footer */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t pt-2">
          <span>Source: {result.source}</span>
          <span>Fetched: {formatDateTime(new Date().toISOString())}</span>
          <span>Customer: {result.custId}</span>
        </div>
      </CardContent>
    </Card>
  );
}
