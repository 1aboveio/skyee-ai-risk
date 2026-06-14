import { headers } from "next/headers";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { RootLayoutShell } from "@/lib/i18n/root-layout-shell";
import { resolveInitialLocale } from "@/lib/i18n/server-locale";
import { getReviewerLocalePreference } from "@/lib/review/store";

export { metadata } from "@/lib/i18n/root-layout-shell";

export default async function AppRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getGraphIdentitySession();
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;

  const locale = await resolveInitialLocale({
    isAuthRoute: false,
    session,
    acceptLanguage,
    getReviewerLocalePreference,
  });

  return <RootLayoutShell locale={locale}>{children}</RootLayoutShell>;
}
