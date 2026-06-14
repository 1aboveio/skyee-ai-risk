import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocaleProvider } from "./locale-provider";
import type { Locale } from "./resolve-locale";

export const metadata: Metadata = {
  title: "Skyee AI Risk",
  description: "Customer risk review and graph investigation console",
};

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function RootLayoutShell({
  locale,
  children,
}: Readonly<{
  locale: Locale;
  children: React.ReactNode;
}>) {
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
