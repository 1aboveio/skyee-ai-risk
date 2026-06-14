import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { resolveLocale, type Locale } from "@/lib/i18n/resolve-locale";
import { getReviewerLocalePreference } from "@/lib/review/store";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skyee AI Risk",
  description: "Customer risk review and graph investigation console",
};

async function resolveInitialLocale(): Promise<Locale> {
  const session = await getGraphIdentitySession();
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;

  if (session) {
    const storedPreference = await getReviewerLocalePreference(
      session.user.id
    ).catch(() => null);
    return resolveLocale(storedPreference ?? undefined, acceptLanguage);
  }

  return resolveLocale(undefined, acceptLanguage);
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await resolveInitialLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          <TooltipProvider>{children}</TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
