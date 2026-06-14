import { defaultLocale, type Locale } from "@/lib/i18n/resolve-locale";
import type { GraphNode } from "./schema";

export function riskVariant(node: Pick<GraphNode, "riskLevel" | "isHighRisk" | "isSanctioned">): "destructive" | "secondary" | "outline" {
  if (node.isSanctioned || node.riskLevel === "HIGH") {
    return "destructive";
  }
  if (node.isHighRisk || node.riskLevel === "MEDIUM_HIGH") {
    return "secondary";
  }
  return "outline";
}

export function displayName(node: GraphNode): string {
  return node.custName ?? `Customer ${node.custId}`;
}

export function formatDate(value: string | null, locale: Locale | string = defaultLocale): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null, locale: Locale | string = defaultLocale): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMoney(value: number | null, locale: Locale | string = defaultLocale, unavailableLabel: string = "Unavailable"): string {
  if (value === null) {
    return unavailableLabel;
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function compactId(value: string): string {
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
