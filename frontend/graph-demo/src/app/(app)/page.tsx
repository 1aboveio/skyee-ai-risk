import { headers } from "next/headers";
import { AppShell } from "@/components/app/app-shell";
import { HomeDashboard } from "@/components/app/home-dashboard";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { resolveInitialLocale } from "@/lib/i18n/server-locale";
import { getReviewerLocalePreference } from "@/lib/review/store";
import { redirect } from "next/navigation";

export default async function Home() {
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
    <AppShell active="home" session={session} locale={locale}>
      <HomeDashboard session={session} locale={locale} />
    </AppShell>
  );
}
