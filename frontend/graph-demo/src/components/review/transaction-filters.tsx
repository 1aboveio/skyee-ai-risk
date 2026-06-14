"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TransactionFilters } from "@/lib/hooks/use-transactions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionFiltersBarProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: TransactionFilters) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionFiltersBar({
  filters,
  onFiltersChange,
}: TransactionFiltersBarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.startDate ||
          filters.endDate ||
          filters.direction ||
          filters.minUsdAmount !== undefined ||
          filters.maxUsdAmount !== undefined
      ),
    [filters]
  );

  const updateUrlParams = useCallback(
    (newFilters: TransactionFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      // Remove existing filter params
      params.delete("startDate");
      params.delete("endDate");
      params.delete("direction");
      params.delete("minUsdAmount");
      params.delete("maxUsdAmount");

      // Add new filter params
      if (newFilters.startDate) params.set("startDate", newFilters.startDate);
      if (newFilters.endDate) params.set("endDate", newFilters.endDate);
      if (newFilters.direction) params.set("direction", newFilters.direction);
      if (newFilters.minUsdAmount !== undefined)
        params.set("minUsdAmount", String(newFilters.minUsdAmount));
      if (newFilters.maxUsdAmount !== undefined)
        params.set("maxUsdAmount", String(newFilters.maxUsdAmount));

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      onFiltersChange(newFilters);
    },
    [searchParams, router, pathname, onFiltersChange]
  );

  const handleDateChange = useCallback(
    (field: "startDate" | "endDate", value: string) => {
      updateUrlParams({ ...filters, [field]: value || undefined });
    },
    [filters, updateUrlParams]
  );

  const handleDirectionChange = useCallback(
    (value: string) => {
      updateUrlParams({
        ...filters,
        direction:
          value === "ALL" || !value
            ? undefined
            : (value as "INBOUND" | "OUTBOUND"),
      });
    },
    [filters, updateUrlParams]
  );

  const handleAmountChange = useCallback(
    (field: "minUsdAmount" | "maxUsdAmount", value: string) => {
      const numValue = value === "" ? undefined : Number(value);
      updateUrlParams({
        ...filters,
        [field]: numValue !== undefined && !isNaN(numValue) ? numValue : undefined,
      });
    },
    [filters, updateUrlParams]
  );

  const handleClearAll = useCallback(() => {
    updateUrlParams({});
  }, [updateUrlParams]);

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 bg-muted/30 rounded-md border">
      {/* Date Range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          From Date
        </label>
        <input
          type="date"
          value={filters.startDate ?? ""}
          onChange={(e) => handleDateChange("startDate", e.target.value)}
          className="h-8 px-2 text-sm border rounded-md bg-background"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          To Date
        </label>
        <input
          type="date"
          value={filters.endDate ?? ""}
          onChange={(e) => handleDateChange("endDate", e.target.value)}
          className="h-8 px-2 text-sm border rounded-md bg-background"
        />
      </div>

      {/* Direction */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Direction
        </label>
        <select
          value={filters.direction ?? "ALL"}
          onChange={(e) => handleDirectionChange(e.target.value)}
          className="h-8 px-2 text-sm border rounded-md bg-background"
        >
          <option value="ALL">All</option>
          <option value="INBOUND">Inbound</option>
          <option value="OUTBOUND">Outbound</option>
        </select>
      </div>

      {/* USD Amount Range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Min USD
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={filters.minUsdAmount ?? ""}
          onChange={(e) => handleAmountChange("minUsdAmount", e.target.value)}
          className="h-8 w-24 px-2 text-sm border rounded-md bg-background"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Max USD
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="No limit"
          value={filters.maxUsdAmount ?? ""}
          onChange={(e) => handleAmountChange("maxUsdAmount", e.target.value)}
          className="h-8 w-24 px-2 text-sm border rounded-md bg-background"
        />
      </div>

      {/* Clear All */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="h-8"
        >
          <X className="mr-1 h-3 w-3" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL Param Parser
// ---------------------------------------------------------------------------

export function parseFiltersFromSearchParams(
  searchParams: URLSearchParams
): TransactionFilters {
  const filters: TransactionFilters = {};

  const startDate = searchParams.get("startDate");
  if (startDate) filters.startDate = startDate;

  const endDate = searchParams.get("endDate");
  if (endDate) filters.endDate = endDate;

  const direction = searchParams.get("direction");
  if (direction === "INBOUND" || direction === "OUTBOUND") {
    filters.direction = direction;
  }

  const minUsdAmount = searchParams.get("minUsdAmount");
  if (minUsdAmount) {
    const parsed = Number(minUsdAmount);
    if (!isNaN(parsed)) filters.minUsdAmount = parsed;
  }

  const maxUsdAmount = searchParams.get("maxUsdAmount");
  if (maxUsdAmount) {
    const parsed = Number(maxUsdAmount);
    if (!isNaN(parsed)) filters.maxUsdAmount = parsed;
  }

  return filters;
}
