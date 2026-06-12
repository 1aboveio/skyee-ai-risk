"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BanIcon,
  DatabaseIcon,
  InfoIcon,
  LanguagesIcon,
  Link2Icon,
  LogOutIcon,
  NetworkIcon,
  RefreshCcwIcon,
  SearchIcon,
  ShieldAlertIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { edgeAnnotations } from "@/lib/graph/edge-annotations";
import { demoCustomers } from "@/lib/graph/mock-data";
import type { GraphEdge, GraphNode, GraphSearchResult } from "@/lib/graph/schema";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: GraphSearchResult | null; error: null }
  | { status: "ready"; data: GraphSearchResult; error: null }
  | { status: "error"; data: GraphSearchResult | null; error: string };

type Locale = "en" | "zh-CN";
type TranslationKey =
  | "accountBalance"
  | "allTypes"
  | "balanceUnavailable"
  | "customerGraph"
  | "customerId"
  | "dataSource"
  | "edgeTypes"
  | "edges"
  | "graph"
  | "highRiskNeighbors"
  | "includeWeak"
  | "language"
  | "lastSeen"
  | "link"
  | "linkType"
  | "linkTypes"
  | "noMatches"
  | "nodes"
  | "records"
  | "relationshipSearch"
  | "relationshipView"
  | "risk"
  | "search"
  | "searchFailed"
  | "selected"
  | "signedInAs"
  | "signOut"
  | "strength"
  | "strong"
  | "suspend"
  | "suspendMocked"
  | "table"
  | "weak"
  | "weakIncluded"
  | "strongOnly";

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    accountBalance: "Account balance",
    allTypes: "All link types",
    balanceUnavailable: "Unavailable",
    customerGraph: "Customer Graph",
    customerId: "Customer ID",
    dataSource: "Data source",
    edgeTypes: "Edge Types",
    edges: "Edges",
    graph: "Graph",
    highRiskNeighbors: "High-Risk Neighbors",
    includeWeak: "Weak links",
    language: "中文",
    lastSeen: "Last seen",
    link: "Link",
    linkType: "Link type",
    linkTypes: "Link types",
    noMatches: "No matches",
    nodes: "Nodes",
    records: "Records",
    relationshipSearch: "Relationship search",
    relationshipView: "Relationship View",
    risk: "Risk",
    search: "Search",
    searchFailed: "Search failed",
    selected: "selected",
    signedInAs: "Signed in as",
    signOut: "Sign out",
    strength: "Strength",
    strong: "Strong",
    suspend: "Suspend",
    suspendMocked: "Mock suspend queued",
    table: "Table",
    weak: "Weak",
    weakIncluded: "Weak links included",
    strongOnly: "Strong links only",
  },
  "zh-CN": {
    accountBalance: "账户余额",
    allTypes: "全部关联类型",
    balanceUnavailable: "暂无",
    customerGraph: "客户图谱",
    customerId: "客户 ID",
    dataSource: "数据来源",
    edgeTypes: "关联类型",
    edges: "关联",
    graph: "图谱",
    highRiskNeighbors: "高风险邻居",
    includeWeak: "弱关联",
    language: "English",
    lastSeen: "最近出现",
    link: "关联",
    linkType: "关联类型",
    linkTypes: "关联类型",
    noMatches: "无匹配",
    nodes: "节点",
    records: "证据数",
    relationshipSearch: "关系查询",
    relationshipView: "关系视图",
    risk: "风险",
    search: "查询",
    searchFailed: "查询失败",
    selected: "已选",
    signedInAs: "当前登录",
    signOut: "退出登录",
    strength: "强度",
    strong: "强关联",
    suspend: "挂起",
    suspendMocked: "已模拟提交挂起",
    table: "表格",
    weak: "弱关联",
    weakIncluded: "包含弱关联",
    strongOnly: "仅强关联",
  },
};

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

function formatDate(value: string | null, locale: Locale): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number | null, locale: Locale): string {
  if (value === null) {
    return translations[locale].balanceUnavailable;
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
  locale,
  session,
  source,
  onCustIdChange,
  onIncludeWeakChange,
  onLocaleChange,
  onSubmit,
}: {
  custId: string;
  includeWeak: boolean;
  isLoading: boolean;
  locale: Locale;
  session: GraphIdentitySession;
  source: GraphSearchResult["source"] | null;
  onCustIdChange: (value: string) => void;
  onIncludeWeakChange: (value: boolean) => void;
  onLocaleChange: (value: Locale) => void;
  onSubmit: () => void;
}) {
  const t = translations[locale];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.customerGraph}</CardTitle>
        <CardDescription>{t.relationshipSearch}</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <div className="hidden min-w-0 flex-col text-right text-xs text-muted-foreground sm:flex">
              <span>{t.signedInAs}</span>
              <span className="max-w-48 truncate text-foreground">{session.user.email}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onLocaleChange(locale === "en" ? "zh-CN" : "en")}
            >
              <LanguagesIcon data-icon="inline-start" />
              {t.language}
            </Button>
            <Button type="button" variant="outline" size="sm" render={<a href="/auth/logout" />}>
              <LogOutIcon data-icon="inline-start" />
              {t.signOut}
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Badge variant="outline" />}>
                <DatabaseIcon data-icon="inline-start" />
                {source ?? "mock"}
              </TooltipTrigger>
              <TooltipContent>{t.dataSource}</TooltipContent>
            </Tooltip>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-id">{t.customerId}</Label>
              <Input
                id="cust-id"
                value={custId}
                onChange={(event) => onCustIdChange(event.target.value)}
                placeholder="1000321"
              />
            </div>
            <Label className="h-9 items-center">
              <Switch checked={includeWeak} onCheckedChange={onIncludeWeakChange} />
              {t.includeWeak}
            </Label>
            <Button type="submit" disabled={isLoading || custId.trim().length === 0}>
              {isLoading ? (
                <RefreshCcwIcon data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              {t.search}
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

type EdgeRow = {
  edge: GraphEdge;
  node: GraphNode | null;
};

function EdgeInfo({ edgeType, locale }: { edgeType: string; locale: Locale }) {
  const annotation = edgeAnnotations[edgeType];
  if (!annotation) {
    return null;
  }
  const title = locale === "zh-CN" ? annotation.titleZh : annotation.title;
  const description = locale === "zh-CN" ? annotation.descriptionZh : annotation.description;

  return (
    <Tooltip>
      <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" />}>
        <InfoIcon data-icon="inline-start" />
      </TooltipTrigger>
      <TooltipContent className="max-w-96">
        <div className="flex flex-col gap-2">
          <div className="font-medium">{title}</div>
          <div>{description}</div>
          <div className="flex flex-wrap gap-1">
            {annotation.fields.slice(0, 8).map((field) => (
              <Badge key={`${field.table}.${field.column}`} variant="outline">
                {field.table}.{field.column} · {field.columnComment}
              </Badge>
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function EdgeTable({
  edges,
  nodes,
  locale,
}: {
  edges: GraphEdge[];
  nodes: GraphNode[];
  locale: Locale;
}) {
  const t = translations[locale];
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.custId, node])),
    [nodes]
  );
  const edgeTypes = useMemo(
    () => Array.from(new Set(edges.map((edge) => edge.edgeType))).sort(),
    [edges]
  );
  const data = useMemo<EdgeRow[]>(
    () =>
      edges.map((edge) => ({
        edge,
        node: nodeById.get(edge.neighborCustId) ?? null,
      })),
    [edges, nodeById]
  );
  const columns = useMemo<ColumnDef<EdgeRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "neighbor",
        accessorFn: (row) => row.edge.neighborCustId,
        header: t.customerId,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex min-w-44 flex-col gap-1">
              <span className="font-medium">{item.edge.neighborCustId}</span>
              <span className="truncate text-muted-foreground">
                {item.node ? displayName(item.node) : "-"}
              </span>
            </div>
          );
        },
      },
      {
        id: "risk",
        header: t.risk,
        cell: ({ row }) => {
          const node = row.original.node;
          return node ? <Badge variant={riskVariant(node)}>{node.riskLevel}</Badge> : "-";
        },
      },
      {
        id: "balance",
        header: t.accountBalance,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.node?.currentBalance ?? null, locale)}
          </span>
        ),
      },
      {
        id: "edgeType",
        accessorFn: (row) => row.edge.edgeType,
        filterFn: (row, columnId, filterValue) => {
          const values = filterValue as string[];
          return values.length === 0 || values.includes(row.getValue(columnId));
        },
        header: t.link,
        cell: ({ row }) => {
          const edge = row.original.edge;
          return (
            <div className="flex min-w-56 items-start gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{edge.edgeType}</span>
                  <EdgeInfo edgeType={edge.edgeType} locale={locale} />
                </div>
                <span className="max-w-72 truncate text-muted-foreground">
                  {edge.edgeValue ?? "-"}
                </span>
              </div>
            </div>
          );
        },
        meta: {
          label: t.linkType,
          variant: "select",
          options: edgeTypes.map((edgeType) => ({ label: edgeType, value: edgeType })),
        },
      },
      {
        id: "strength",
        header: t.strength,
        cell: ({ row }) => {
          const edge = row.original.edge;
          return (
            <Badge variant={edge.strength === "Strong" ? "default" : "outline"}>
              {edge.strength === "Strong" ? t.strong : t.weak}
            </Badge>
          );
        },
      },
      {
        id: "records",
        accessorFn: (row) => row.edge.recordCount,
        header: t.records,
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.edge.recordCount}</span>
        ),
      },
      {
        id: "lastSeen",
        accessorFn: (row) => row.edge.lastSeen,
        header: t.lastSeen,
        cell: ({ row }) => formatDate(row.original.edge.lastSeen, locale),
      },
    ],
    [edgeTypes, locale, t]
  );
  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnFilters: [{ id: "edgeType", value: selectedTypes }],
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  useEffect(() => {
    setRowSelection({});
  }, [data, selectedTypes]);

  useEffect(() => {
    setSelectedTypes((current) => current.filter((edgeType) => edgeTypes.includes(edgeType)));
  }, [edgeTypes]);

  function toggleType(edgeType: string, checked: boolean) {
    setSelectedTypes((current) =>
      checked
        ? Array.from(new Set([...current, edgeType]))
        : current.filter((value) => value !== edgeType)
    );
  }

  function suspendSelected() {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.edge.neighborCustId);
    setActionMessage(`${t.suspendMocked}: ${selectedIds.join(", ")}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Data table toolbar">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <SlidersHorizontalIcon data-icon="inline-start" />
              {selectedTypes.length === 0 ? t.allTypes : `${selectedTypes.length} ${t.linkTypes}`}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>{t.linkTypes}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.length === 0}
                  onCheckedChange={() => setSelectedTypes([])}
                >
                  {t.allTypes}
                </DropdownMenuCheckboxItem>
                {edgeTypes.map((edgeType) => (
                  <DropdownMenuCheckboxItem
                    key={edgeType}
                    checked={selectedTypes.includes(edgeType)}
                    onCheckedChange={(checked) => toggleType(edgeType, Boolean(checked))}
                  >
                    {edgeType}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant="outline">
            {selectedCount} {t.selected}
          </Badge>
        </div>
        <Button type="button" size="sm" disabled={selectedCount === 0} onClick={suspendSelected}>
          <BanIcon data-icon="inline-start" />
          {t.suspend}
        </Button>
      </div>
      {actionMessage ? (
        <Alert>
          <InfoIcon data-icon="inline-start" />
          <AlertTitle>{t.suspend}</AlertTitle>
          <AlertDescription>{actionMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t.noMatches}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function HighRiskPanel({ result, locale }: { result: GraphSearchResult; locale: Locale }) {
  const t = translations[locale];
  const highRiskNodes = result.nodes.filter((node) => node.isHighRisk || node.isSanctioned);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{t.highRiskNeighbors}</CardTitle>
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
            <div className="text-muted-foreground">{t.noMatches}</div>
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

export function GraphDemo({ session }: { session: GraphIdentitySession }) {
  const [custId, setCustId] = useState(initialCustomerId);
  const [includeWeak, setIncludeWeak] = useState(true);
  const [locale, setLocale] = useState<Locale>("en");
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
  const t = translations[locale];

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
        <CustomerSearch
          custId={custId}
          includeWeak={includeWeak}
          isLoading={isLoading}
          locale={locale}
          session={session}
          source={result?.source ?? null}
          onCustIdChange={setCustId}
          onIncludeWeakChange={setIncludeWeak}
          onLocaleChange={setLocale}
          onSubmit={runSearch}
        />

        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertCircleIcon data-icon="inline-start" />
            <AlertTitle>{t.searchFailed}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard title={t.nodes} value={result.stats.nodeCount} icon={UsersIcon} />
              <MetricCard title={t.edges} value={result.stats.edgeCount} icon={NetworkIcon} />
              <MetricCard title={t.strong} value={result.stats.strongEdgeCount} icon={Link2Icon} />
              <MetricCard title={t.weak} value={result.stats.weakEdgeCount} icon={Link2Icon} />
              <MetricCard title={t.risk} value={result.stats.highRiskCount} icon={ShieldAlertIcon} />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>{t.relationshipView}</CardTitle>
                  <CardDescription>{result.custId}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="graph" className="gap-4">
                    <TabsList>
                      <TabsTrigger value="graph">{t.graph}</TabsTrigger>
                      <TabsTrigger value="table">{t.table}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="graph">
                      <GraphCanvas result={result} />
                    </TabsContent>
                    <TabsContent value="table">
                      <EdgeTable edges={result.edges} nodes={result.nodes} locale={locale} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-5">
                <HighRiskPanel result={result} locale={locale} />
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>{t.edgeTypes}</CardTitle>
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
                      {includeWeak ? t.weakIncluded : t.strongOnly}
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
