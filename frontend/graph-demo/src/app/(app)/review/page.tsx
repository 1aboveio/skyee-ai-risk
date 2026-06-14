import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { ReviewEntrySearch } from "@/components/review/review-entry-search";
import { Badge } from "@/components/ui/badge";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { ClipboardCheckIcon, DatabaseIcon, FileTextIcon, HistoryIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { resolveInitialLocale } from "@/lib/i18n/server-locale";
import { getReviewerLocalePreference } from "@/lib/review/store";

const evidenceSections = [
  { label: "Customer profile", icon: FileTextIcon },
  { label: "Risk signals", icon: ClipboardCheckIcon },
  { label: "Recent transactions", icon: DatabaseIcon },
  { label: "Review history", icon: HistoryIcon },
];

export default async function ReviewWorkbenchEntryPage() {
  const session = await getGraphIdentitySession();
  if (!session) {
    redirect("/auth/login");
  }

  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;
  const locale = await resolveInitialLocale({
    isAuthRoute: false,
    session,
    acceptLanguage,
    getReviewerLocalePreference,
  });

  return (
    <AppShell active="review" session={session} locale={locale}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 md:px-6 md:py-8">
        <section className="border-b pb-5">
          <Badge variant="outline">Human Review</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Review Workbench Entry
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Open a customer-level Review Evidence Package for prescreening, second round review, or ad hoc investigation.
          </p>
        </section>

        <ReviewEntrySearch />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {evidenceSections.map((section) => {
            const Icon = section.icon;

            return (
              <div key={section.label} className="rounded-lg border bg-card p-4">
                <Icon className="size-4 text-primary" />
                <div className="mt-3 text-sm font-medium">{section.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">Loaded after customer search</div>
              </div>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
