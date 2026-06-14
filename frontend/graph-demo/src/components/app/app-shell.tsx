import Link from "next/link";
import {
  ClipboardCheckIcon,
  HomeIcon,
  LogOutIcon,
  NetworkIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "./language-switcher";

type AppModule = "home" | "graph" | "review";

type NavItem = {
  key: AppModule;
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: HomeIcon },
  { key: "graph", label: "Graph Network Search", href: "/graph", icon: NetworkIcon },
  { key: "review", label: "Review Workbench", href: "/review", icon: ClipboardCheckIcon },
];

export function AppShell({
  active,
  children,
  session,
}: {
  active: AppModule;
  children: React.ReactNode;
  session: GraphIdentitySession;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-sidebar-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Skyee AI Risk</div>
              <div className="truncate text-xs text-muted-foreground">Operations Console</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  selected &&
                    "bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-background/70 p-3 ring-1 ring-border">
            <div className="truncate text-xs text-muted-foreground">Signed in</div>
            <div className="mt-1 truncate text-sm font-medium">{session.user.email}</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Badge variant="outline">{session.membership.role}</Badge>
              <a
                href="/auth/logout"
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <LogOutIcon className="size-4" />
                <span className="sr-only">Sign out</span>
              </a>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b bg-background px-4 md:px-6 lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-4" />
            </div>
            <span className="truncate text-sm font-semibold">Skyee AI Risk</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <a
              href="/auth/logout"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <LogOutIcon className="size-4" />
              Sign out
            </a>
          </div>
        </header>

        <nav
          className="grid grid-cols-3 border-b bg-sidebar px-2 py-2 lg:hidden"
          aria-label="Module navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = active === item.key;

            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-10 flex-col items-center justify-center gap-1 rounded-lg px-2 text-center text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                  selected && "bg-primary/10 text-primary ring-1 ring-primary/20"
                )}
              >
                <Icon className="size-4" />
                <span className="line-clamp-2 leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
