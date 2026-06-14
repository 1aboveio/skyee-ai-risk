"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  DatabaseIcon,
  InfoIcon,
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
import { GraphCanvas } from "@/components/graph/graph-canvas";
import { fetchGraph } from "@/lib/graph/fetch";
import { riskVariant, displayName, formatDateTime } from "@/lib/graph/utils";
import {
  getEdgeAnnotation,
  sameAttributeTypeLabels,
} from "@/lib/graph/edge-annotations";
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

function renderSameAttributeTypeLabel(value: string | undefined): string {
  return value ? sameAttributeTypeLabels[value] ?? value : "Unknown";
}

function EdgeInfo({ edge }: { edge: GraphEdge }) {
  const annotation = getEdgeAnnotation({
    edgeType: edge.edgeType,
    sameAttributeType: edge.sameAttributeType,
  });
  if (!annotation) {
    return null;
  }

  const fieldSource = edge.edgeSource?.trim();
  const fieldName = edge.edgeSourceField?.trim();
  const hasProvenance = Boolean(fieldSource || fieldName || edge.attributeLinkType);

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button type="button" variant="ghost" size="icon" className="h-6 w-6" />}
      >
        <span className="sr-only">Provenance</span>
        <InfoIcon className="h-3 w-3" />
      </TooltipTrigger>
      <TooltipContent className="max-w-96">
        <div className="flex flex-col gap-2">
          <div className="font-medium">
            {edge.sameAttributeType
              ? sameAttributeTypeLabels[edge.sameAttributeType] ?? annotation.title
              : annotation.title}
          </div>
          <div className="text-sm">{annotation.description}</div>
          {hasProvenance ? (
            <div className="text-muted-foreground">
              <div>{`Attribute link: ${edge.attributeLinkType ?? "derived"}`}</div>
              {fieldName ? <div>{`Field: ${fieldSource}.${fieldName}`}</div> : null}
              {!fieldName && fieldSource ? <div>{`Source: ${fieldSource}`}</div> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {annotation.fields.slice(0, 8).map((field) => (
              <Badge key={`${field.table}.${field.column}`} variant="outline" className="text-[10px]">
                {field.table}.{field.column}
              </Badge>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EdgeRow({ edge, node }: { edge: GraphEdge; node: GraphNode | null }) {
  const edgeDimension = edge.sameAttributeType ?? edge.edgeType;
  const category = categorizeEdgeType(edgeDimension);
  return (
    <TableRow>
      <TableCell className="py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{renderSameAttributeTypeLabel(edgeDimension)}</span>
          <EdgeInfo edge={edge} />
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
      const edgeDimension = edge.sameAttributeType ?? edge.edgeType;
      counts[categorizeEdgeType(edgeDimension)]++;
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
  // Uses AbortController to cancel in-flight requests on cleanup.
  useEffect(() => {
    const controller = new AbortController();

    fetchGraph({ custId, includeWeak, signal: controller.signal })
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
    <WorkbenchPanel title="Risk Graph">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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

        {state.status === "error" && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon className="h-4 w-4" />
            <AlertTitle>Graph Error</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {result.warnings && result.warnings.length > 0 ? (
          <Alert className="mb-4">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Warnings</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {result.warnings.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

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
      </div>
    </WorkbenchPanel>
  );
}
