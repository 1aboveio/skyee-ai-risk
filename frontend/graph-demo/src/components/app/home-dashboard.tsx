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

const modules = [
  {
    title: "Graph Network Search",
    description: "Search a customer and inspect relationship nodes, links, source fields, and high-risk neighbors.",
    href: "/graph",
    icon: NetworkIcon,
    status: "Live",
  },
  {
    title: "Review Workbench",
    description: "Open a customer evidence package for human review, notes, snapshots, and final disposition.",
    href: "/review",
    icon: ClipboardCheckIcon,
    status: "Live",
  },
];

export function HomeDashboard({ session }: { session: GraphIdentitySession }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
      <section className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              <ShieldCheckIcon data-icon="inline-start" />
              Risk Operations
            </Badge>
            <Badge variant="secondary">{session.organization.name}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Customer Risk Review Console
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Start from customer identity, then move between graph evidence and human review without changing tools.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3 text-sm md:min-w-72">
          <div>
            <div className="text-xs text-muted-foreground">Reviewer</div>
            <div className="mt-1 truncate font-medium">{session.user.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Access</div>
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
                  {module.title}
                </CardTitle>
                <CardDescription>{module.description}</CardDescription>
                <CardAction>
                  <Badge variant="outline">{module.status}</Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <Link
                  href={module.href}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <SearchIcon className="size-4" />
                  Open search
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
            Evidence Boundary
          </div>
          <div className="mt-3 grid divide-y text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="py-3 md:py-0 md:pr-4">
              <div className="font-medium">Graph data</div>
              <div className="mt-1 text-muted-foreground">Network search and relationship evidence.</div>
            </div>
            <div className="py-3 md:px-4 md:py-0">
              <div className="font-medium">Source evidence</div>
              <div className="mt-1 text-muted-foreground">Customer profile, risk signals, and transactions.</div>
            </div>
            <div className="py-3 md:py-0 md:pl-4">
              <div className="font-medium">Review store</div>
              <div className="mt-1 text-muted-foreground">Notes, snapshots, review sessions, and disposition.</div>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Workflow Position</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Prescreening</div>
            <div>Second round human review</div>
            <div>Ad hoc investigation</div>
          </div>
        </div>
      </section>
    </div>
  );
}
