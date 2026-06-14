"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardCheckIcon,
  DatabaseIcon,
  NetworkIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { t } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/keys";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

type ModuleConfig = {
  title: DictionaryKey;
  description: DictionaryKey;
  href: string;
  icon: typeof NetworkIcon;
  status: DictionaryKey;
};

const modules: ModuleConfig[] = [
  {
    title: "graphNetworkSearch",
    description: "graphNetworkSearchDescription",
    href: "/graph",
    icon: NetworkIcon,
    status: "live",
  },
  {
    title: "reviewWorkbench",
    description: "reviewWorkbenchDescription",
    href: "/review",
    icon: ClipboardCheckIcon,
    status: "live",
  },
];

const evidenceColumns: { label: DictionaryKey; description: DictionaryKey }[] = [
  { label: "graphData", description: "graphDataDescription" },
  { label: "sourceEvidence", description: "sourceEvidenceDescription" },
  { label: "reviewStore", description: "reviewStoreDescription" },
];

const workflowItems: DictionaryKey[] = [
  "prescreening",
  "secondRoundHumanReview",
  "adHocInvestigation",
];

export function HomeDashboard({ session }: { session: GraphIdentitySession }) {
  const { locale } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
      <section className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <ShieldCheckIcon data-icon="inline-start" />
              {t("riskOperations", locale)}
            </Badge>
            <Badge variant="secondary">{session.organization.name}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("customerRiskReviewConsole", locale)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("homeHeroDescription", locale)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3 text-sm md:min-w-72">
          <div>
            <div className="text-xs text-muted-foreground">{t("reviewer", locale)}</div>
            <div className="mt-1 truncate font-medium">{session.user.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("access", locale)}</div>
            <div className="mt-1 font-medium">{session.membership.status}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <Card key={module.href} className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-primary" />
                  {t(module.title, locale)}
                </CardTitle>
                <CardDescription>{t(module.description, locale)}</CardDescription>
                <CardAction>
                  <Badge variant="outline">{t(module.status, locale)}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Link
                  href={module.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <SearchIcon className="size-4" />
                  {t("openSearch", locale)}
                  <ArrowRightIcon className="size-4" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <DatabaseIcon className="size-4 text-primary" />
            {t("evidenceBoundary", locale)}
          </div>
          <div className="mt-3 grid divide-y text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
            {evidenceColumns.map((col, index) => {
              const isFirst = index === 0;
              const isLast = index === evidenceColumns.length - 1;
              return (
                <div
                  key={col.label}
                  className={cn(
                    "py-3 md:py-0",
                    isFirst && "md:pr-4",
                    !isFirst && !isLast && "md:px-4",
                    isLast && "md:pl-4"
                  )}
                >
                  <div className="font-medium">{t(col.label, locale)}</div>
                  <div className="mt-1 text-muted-foreground">{t(col.description, locale)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">{t("workflowPosition", locale)}</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {workflowItems.map((item) => (
              <div key={item}>{t(item, locale)}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
