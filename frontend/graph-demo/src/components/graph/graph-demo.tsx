"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BanIcon,
  DatabaseIcon,
  InfoIcon,
  Link2Icon,
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
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/resolve-locale";
import {
  getEdgeAnnotation,
  getLocalizedEdgeAnnotation,
  getSameAttributeTypeLabel,
  sameAttributeTypeLabels,
} from "@/lib/graph/edge-annotations";
import { demoCustomers } from "@/lib/graph/mock-data";
import { fetchGraph } from "@/lib/graph/fetch";
import { riskVariant, displayName, formatDate, formatMoney, compactId } from "@/lib/graph/utils";
import type { GraphEdge, GraphNode, GraphSearchResult } from "@/lib/graph/schema";
import { GraphCanvas } from "@/components/graph/graph-canvas";

type LoadState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: GraphSearchResult | null; error: null }
  | { status: "ready"; data: GraphSearchResult; error: null }
  | { status: "error"; data: GraphSearchResult | null; error: string };

const v1SameAttributeTypeOptions = Object.keys(sameAttributeTypeLabels).sort();

function primaryEdgeDimension(edge: GraphEdge): string {
  return edge.sameAttributeType ?? edge.edgeType;
}

const initialCustomerId = demoCustomers[0] ?? "1000321";

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
  source,
  onCustIdChange,
  onIncludeWeakChange,
  onSubmit,
}: {
  custId: string;
  includeWeak: boolean;
  isLoading: boolean;
  locale: Locale;
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
        <CardTitle>{t("customerGraph", locale)}</CardTitle>
        <CardDescription>{t("relationshipSearch", locale)}</CardDescription>
        <CardAction>
          <Tooltip>
            <TooltipTrigger render={<Badge variant="outline" />}>
              <DatabaseIcon data-icon="inline-start" />
              {source ?? "mock"}
            </TooltipTrigger>
            <TooltipContent>{t("dataSource", locale)}</TooltipContent>
          </Tooltip>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cust-id">{t("customerId", locale)}</Label>
              <Input
                id="cust-id"
                value={custId}
                onChange={(event) => onCustIdChange(event.target.value)}
                placeholder="1000321"
              />
            </div>
            <Label className="h-9 items-center">
              <Switch checked={includeWeak} onCheckedChange={onIncludeWeakChange} />
              {t("includeWeak", locale)}
            </Label>
            <Button type="submit" disabled={isLoading || custId.trim().length === 0}>
              {isLoading ? (
                <RefreshCcwIcon data-icon="inline-start" />
              ) : (
                <SearchIcon data-icon="inline-start" />
              )}
              {t("search", locale)}
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

type EdgeRow = {
  edge: GraphEdge;
  node: GraphNode | null;
};

function EdgeInfo({
  edge,
  locale,
}: {
  edge: GraphEdge;
  locale: Locale;
}) {
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

  const { title, description } = getLocalizedEdgeAnnotation(annotation, locale);

  return (
    <Tooltip>
      <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" />}>
        <span className="sr-only">Provenance</span>
        <InfoIcon data-icon="inline-start" />
      </TooltipTrigger>
      <TooltipContent className="max-w-96">
        <div className="flex flex-col gap-2">
          <div className="font-medium">{title}</div>
          <div>{description}</div>
          {hasProvenance ? (
            <div className="text-muted-foreground">
              <div>
                {`Attribute link: ${edge.attributeLinkType ?? "derived"}`}
              </div>
              {fieldName ? <div>{`Field: ${fieldSource}.${fieldName}`}</div> : null}
              {!fieldName && fieldSource ? <div>{`Source: ${fieldSource}`}</div> : null}
            </div>
          ) : null}
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
  selectedTypes,
  onSelectedTypesChange,
}: {
  edges: GraphEdge[];
  nodes: GraphNode[];
  locale: Locale;
  selectedTypes: string[];
  onSelectedTypesChange: (values: string[]) => void;
}) {
  const $t = useCallback(
    (key: Parameters<typeof t>[0]) => t(key, locale),
    [locale]
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.custId, node])),
    [nodes]
  );
  const edgeTypeFilters = v1SameAttributeTypeOptions;
  const edgeTypeLabels = useMemo(
    () =>
      Object.fromEntries(
        edgeTypeFilters.map((edgeType) => [
          edgeType,
          getSameAttributeTypeLabel(edgeType, locale),
        ])
      ),
    [edgeTypeFilters, locale]
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
        header: $t("customerId"),
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
        header: $t("risk"),
        cell: ({ row }) => {
          const node = row.original.node;
          return node ? <Badge variant={riskVariant(node)}>{node.riskLevel}</Badge> : "-";
        },
      },
      {
        id: "balance",
        header: $t("accountBalance"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.node?.currentBalance ?? null, locale, $t("balanceUnavailable"))}
          </span>
        ),
      },
      {
        id: "edgeType",
        accessorFn: (row) => primaryEdgeDimension(row.edge),
        filterFn: (row, columnId, filterValue) => {
          const values = filterValue as string[];
          return values.length === 0 || values.includes(row.getValue(columnId));
        },
        header: $t("link"),
        cell: ({ row }) => {
          const edge = row.original.edge;
          const edgeType = primaryEdgeDimension(edge);
          return (
            <div className="flex min-w-56 items-start gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getSameAttributeTypeLabel(edgeType, locale)}</span>
                  <EdgeInfo edge={edge} locale={locale} />
                </div>
                <span className="max-w-72 truncate text-muted-foreground">
                  {edge.edgeValue ?? "-"}
                </span>
              </div>
            </div>
          );
        },
        meta: {
          label: $t("linkType"),
          variant: "select",
          options: edgeTypeFilters.map((edgeType) => ({
            label: edgeTypeLabels[edgeType],
            value: edgeType,
          })),
        },
      },
      {
        id: "strength",
        header: $t("strength"),
        cell: ({ row }) => {
          const edge = row.original.edge;
          return (
            <Badge variant={edge.strength === "Strong" ? "default" : "outline"}>
              {edge.strength === "Strong" ? $t("strong") : $t("weak")}
            </Badge>
          );
        },
      },
      {
        id: "records",
        accessorFn: (row) => row.edge.recordCount,
        header: $t("records"),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.edge.recordCount}</span>
        ),
      },
      {
        id: "lastSeen",
        accessorFn: (row) => row.edge.lastSeen,
        header: $t("lastSeen"),
        cell: ({ row }) => formatDate(row.original.edge.lastSeen, locale),
      },
    ],
    [edgeTypeFilters, edgeTypeLabels, locale, $t]
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

  function toggleType(edgeType: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...selectedTypes, edgeType]))
      : selectedTypes.filter((value) => value !== edgeType);
    onSelectedTypesChange(next);
  }

  function suspendSelected() {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.edge.neighborCustId);
    setActionMessage(`${$t("suspendMocked")}: ${selectedIds.join(", ")}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2" aria-label="Data table toolbar">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <SlidersHorizontalIcon data-icon="inline-start" />
              {selectedTypes.length === 0 ? $t("allTypes") : `${selectedTypes.length} ${$t("linkTypes")}`}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>{$t("linkTypes")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.length === 0}
                  onCheckedChange={() => onSelectedTypesChange([])}
                >
                  {$t("allTypes")}
                </DropdownMenuCheckboxItem>
                {edgeTypeFilters.map((edgeType) => (
                  <DropdownMenuCheckboxItem
                    key={edgeType}
                    checked={selectedTypes.includes(edgeType)}
                    onCheckedChange={(checked) => toggleType(edgeType, Boolean(checked))}
                  >
                    {edgeTypeLabels[edgeType]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-2 flex flex-wrap gap-2" aria-label="Filter quick pills">
            {edgeTypeFilters.map((edgeType) => {
              const checked = selectedTypes.includes(edgeType);
              return (
                <Button
                  key={`filter-${edgeType}`}
                  type="button"
                  size="sm"
                  variant={checked ? "default" : "outline"}
                  onClick={() => toggleType(edgeType, !checked)}
                >
                  {edgeTypeLabels[edgeType]}
                </Button>
              );
            })}
          </div>
          <Badge variant="outline">
            {selectedCount} {$t("selected")}
          </Badge>
        </div>
        <Button type="button" size="sm" disabled={selectedCount === 0} onClick={suspendSelected}>
          <BanIcon data-icon="inline-start" />
          {$t("suspend")}
        </Button>
      </div>
      {actionMessage ? (
        <Alert>
          <InfoIcon data-icon="inline-start" />
          <AlertTitle>{$t("suspend")}</AlertTitle>
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
                  {$t("noMatches")}
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
  const $t = (key: Parameters<typeof t>[0]) => t(key, locale);
  const highRiskNodes = result.nodes.filter((node) => node.isHighRisk || node.isSanctioned);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{$t("highRiskNeighbors")}</CardTitle>
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
            <div className="text-muted-foreground">{$t("noMatches")}</div>
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
  const { locale } = useLocale();
  const [custId, setCustId] = useState(initialCustomerId);
  const [includeWeak, setIncludeWeak] = useState(true);
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([]);
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
      const data = await fetchGraph({ custId: trimmed, includeWeak });
      setState({ status: "ready", data, error: null });
    } catch (error) {
      setState((current) => ({
        status: "error",
        data: current.data,
        error: error instanceof Error ? error.message : t("searchFailed", locale),
      }));
    }
  }, [custId, includeWeak, locale]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const result = state.data;
  const isLoading = state.status === "loading";
  const $t = (key: Parameters<typeof t>[0]) => t(key, locale);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 md:py-8">
      <section className="border-b pb-5">
        <Badge variant="outline">{$t("graph")}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{$t("graphNetworkSearchTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {$t("graphNetworkSearchDescription")}
        </p>
      </section>

        <CustomerSearch
          custId={custId}
          includeWeak={includeWeak}
          isLoading={isLoading}
          locale={locale}
          source={result?.source ?? null}
          onCustIdChange={setCustId}
          onIncludeWeakChange={setIncludeWeak}
          onSubmit={runSearch}
        />

        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertCircleIcon data-icon="inline-start" />
            <AlertTitle>{$t("searchFailed")}</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {result ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard title={$t("nodes")} value={result.stats.nodeCount} icon={UsersIcon} />
              <MetricCard title={$t("edges")} value={result.stats.edgeCount} icon={NetworkIcon} />
              <MetricCard title={$t("strong")} value={result.stats.strongEdgeCount} icon={Link2Icon} />
              <MetricCard title={$t("weak")} value={result.stats.weakEdgeCount} icon={Link2Icon} />
              <MetricCard title={$t("risk")} value={result.stats.highRiskCount} icon={ShieldAlertIcon} />
            </section>

            <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
              <Card>
                <CardHeader>
                  <CardTitle>{$t("relationshipView")}</CardTitle>
                  <CardDescription>{result.custId}</CardDescription>
                </CardHeader>
                <CardContent>
                  {(result.warnings?.length ?? 0) > 0 ? (
                    <Alert variant="default" className="mb-3">
                      <InfoIcon data-icon="inline-start" />
                      <AlertTitle>{$t("warnings")}</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-5">
                          {result.warnings.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <Tabs defaultValue="graph" className="gap-4">
                    <TabsList>
                      <TabsTrigger value="graph">{$t("graph")}</TabsTrigger>
                      <TabsTrigger value="table">{$t("table")}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="graph">
                      <GraphCanvas result={result} />
                    </TabsContent>
                    <TabsContent value="table">
                      <EdgeTable
                        edges={result.edges}
                        nodes={result.nodes}
                        locale={locale}
                        selectedTypes={selectedTypeFilters}
                        onSelectedTypesChange={setSelectedTypeFilters}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-5">
                <HighRiskPanel result={result} locale={locale} />
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>{$t("edgeTypes")}</CardTitle>
                    <CardAction>
                      <NetworkIcon data-icon="inline-start" />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(
                        new Set(result.edges.map((edge) => primaryEdgeDimension(edge)))
                      ).map((edgeType) => (
                        <Badge key={edgeType} variant="secondary">
                          {getSameAttributeTypeLabel(edgeType, locale)}
                        </Badge>
                      ))}
                    </div>
                    <Separator className="my-4" />
                    <div className="text-muted-foreground">
                      {includeWeak ? $t("weakIncluded") : $t("strongOnly")}
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
  );
}
