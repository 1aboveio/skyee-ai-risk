import { headers } from "next/headers";
import { RootLayoutShell } from "@/lib/i18n/root-layout-shell";
import { resolveInitialLocale } from "@/lib/i18n/server-locale";

export { metadata } from "@/lib/i18n/root-layout-shell";

export default async function AuthRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;

  // Auth routes must never read or write the signed-in reviewer preference.
  const locale = await resolveInitialLocale({
    isAuthRoute: true,
    session: null,
    acceptLanguage,
    getReviewerLocalePreference: async () => null,
  });

  return <RootLayoutShell locale={locale}>{children}</RootLayoutShell>;
}
