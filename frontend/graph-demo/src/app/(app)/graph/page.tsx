import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { GraphDemo } from "@/components/graph/graph-demo";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { resolveInitialLocale } from "@/lib/i18n/server-locale";
import { getReviewerLocalePreference } from "@/lib/review/store";
import { redirect } from "next/navigation";

export default async function GraphNetworkSearchPage() {
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
    <AppShell active="graph" session={session} locale={locale}>
      <GraphDemo />
    </AppShell>
  );
}
