"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  DatabaseIcon,
  Link2Icon,
  NetworkIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { demoCustomers } from "@/lib/graph/mock-data";
import type { GraphEdge, GraphNode, GraphSearchResult } from "@/lib/graph/schema";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: GraphSearchResult | null; error: null }
  | { status: "ready"; data: GraphSearchResult; error: null }
  | { status: "error"; data: GraphSearchResult | null; error: string };

const initialCustomerId = demoCustomers[0] ?? "1000321";

function riskVariant(node: Pick<GraphNode, "riskLevel" | "isHighRisk" | "isSanctioned">) {
  if (node.isSanctioned || node.riskLevel === "HIGH") {
    return "destructive";
  }
  if (node.isHighRisk || node.riskLevel === "MEDIUM_HIGH") {
    return "secondary";
  }
  return "outline";
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function displayName(node: GraphNode): string {
  return node.custName ?? `Customer ${node.custId}`;
}

function compactId(value: string): string {
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Icon data-icon="inline-start" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function CustomerSearch({
  custId,
  includeWeak,
  isLoading,
  source,
  onCustIdChange,
  onIncludeWeakChange,
  onSubmit,
}: {
  custId: string;
  includeWeak: boolean;
  isLoading: boolean;
  source: GraphSearchResult["source"] | null;
  onCustIdChange: (value: string) => void;
  onIncludeWeakChange: (value: boolean) => void;
  onSubmit: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Graph</CardTitle>
        <CardDescription>Relationship search</CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger render={<Badge variant="outline" />}>
              <DatabaseIcon data-icon="inline-start" />
              {source ?? "mock"}
            </TooltipTrigger>
            <TooltipContent>Data source</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-id">Customer ID</Label>
              <Input
                id="cust-id"
                value={custId}
                onChange={(event) => onCustIdChange(event.target.value)}
                placeholder="1000321"
              />
            </div>
            <Label className="h-9 items-center">
              <Switch checked={includeWeak} onCheckedChange={onIncludeWeakChange} />
              Weak links
            </Label>
            <Button type="submit" disabled={isLoading || custId.trim().length === 0}>
              {isLoading ? (
                <RefreshCcwIcon data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              Search
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {demoCustomers.map((id) => (
              <Button
                key={id}
                type="button"
                variant={id === custId ? "default" : "outline"}
                size="sm"
                onClick={() => onCustIdChange(id)}
              >
                {compactId(id)}
              </Button>
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
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
                className={cn(
                  "text-[13px] font-semibold",
                  isCenter || node.isHighRisk ? "fill-primary-foreground" : "fill-foreground"
                )}
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

function EdgeTable({ edges, nodes }: { edges: GraphEdge[]; nodes: GraphNode[] }) {
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.custId, node])),
    [nodes]
  );

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Neighbor</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Link</TableHead>
            <TableHead>Strength</TableHead>
            <TableHead>Records</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {edges.map((edge) => {
            const node = nodeById.get(edge.neighborCustId);
            return (
              <TableRow key={edge.edgeId}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{edge.neighborCustId}</span>
                    <span className="text-muted-foreground">{node ? displayName(node) : "-"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {node ? <Badge variant={riskVariant(node)}>{node.riskLevel}</Badge> : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{edge.edgeType}</span>
                    <span className="max-w-64 truncate text-muted-foreground">
                      {edge.edgeValue ?? "-"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={edge.strength === "Strong" ? "default" : "outline"}>
                    {edge.strength}
                  </Badge>
                </TableCell>
                <TableCell className="tabular-nums">{edge.recordCount}</TableCell>
                <TableCell>{formatDate(edge.lastSeen)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function HighRiskPanel({ result }: { result: GraphSearchResult }) {
  const highRiskNodes = result.nodes.filter((node) => node.isHighRisk || node.isSanctioned);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>High-Risk Neighbors</CardTitle>
        <CardAction>
          <ShieldAlertIcon data-icon="inline-start" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {highRiskNodes.map((node) => (
            <div key={node.custId} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{displayName(node)}</div>
                <div className="text-muted-foreground">{node.custId}</div>
              </div>
              <Badge variant={riskVariant(node)}>{node.isSanctioned ? "SANCTIONED" : node.riskLevel}</Badge>
            </div>
          ))}
          {highRiskNodes.length === 0 ? (
            <div className="text-muted-foreground">No matches</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Skeleton className="h-[440px] rounded-lg" />
      <Skeleton className="h-[280px] rounded-lg" />
    </div>
  );
}

export function GraphDemo() {
  const [custId, setCustId] = useState(initialCustomerId);
  const [includeWeak, setIncludeWeak] = useState(true);
  const [state, setState] = useState<LoadState>({
    status: "idle",
    data: null,
    error: null,
  });

  const runSearch = useCallback(async () => {
    const trimmed = custId.trim();
    if (!trimmed) {
      return;
    }
    setState((current) => ({ status: "loading", data: current.data, error: null }));
    try {
      const data = await fetchGraph(trimmed, includeWeak);
      setState({ status: "ready", data, error: null });
    } catch (error) {
      setState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : "Search failed",
      }));
    }
  }, [custId, includeWeak]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const result = state.data;
  const isLoading = state.status === "loading";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
        <CustomerSearch
          custId={custId}
          includeWeak={includeWeak}
          isLoading={isLoading}
          source={result?.source ?? null}
          onCustIdChange={setCustId}
          onIncludeWeakChange={setIncludeWeak}
          onSubmit={runSearch}
        />

        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertCircleIcon data-icon="inline-start" />
            <AlertTitle>Search failed</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard title="Nodes" value={result.stats.nodeCount} icon={UsersIcon} />
              <MetricCard title="Edges" value={result.stats.edgeCount} icon={NetworkIcon} />
              <MetricCard title="Strong" value={result.stats.strongEdgeCount} icon={Link2Icon} />
              <MetricCard title="Weak" value={result.stats.weakEdgeCount} icon={Link2Icon} />
              <MetricCard title="Risk" value={result.stats.highRiskCount} icon={ShieldAlertIcon} />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>Relationship View</CardTitle>
                  <CardDescription>{result.custId}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="graph" className="gap-4">
                    <TabsList>
                      <TabsTrigger value="graph">Graph</TabsTrigger>
                      <TabsTrigger value="table">Table</TabsTrigger>
                    </TabsList>
                    <TabsContent value="graph">
                      <GraphCanvas result={result} />
                    </TabsContent>
                    <TabsContent value="table">
                      <EdgeTable edges={result.edges} nodes={result.nodes} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-5">
                <HighRiskPanel result={result} />
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Edge Types</CardTitle>
                    <CardAction>
                      <NetworkIcon data-icon="inline-start" />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(result.edges.map((edge) => edge.edgeType))).map(
                        (edgeType) => (
                          <Badge key={edgeType} variant="secondary">
                            {edgeType}
                          </Badge>
                        )
                      )}
                    </div>
                    <Separator className="my-4" />
                    <div className="text-muted-foreground">
                      {includeWeak ? "Weak links included" : "Strong links only"}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        ) : (
          <LoadingPanel />
        )}
      </div>
    </main>
  );
}
