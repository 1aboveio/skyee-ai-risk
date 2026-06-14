"use client";

import { useState } from "react";
import { LanguagesIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/i18n/locale-provider";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

const locales: Locale[] = ["en", "zh-CN"];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(nextLocale: Locale) {
    setError(null);
    setLocale(nextLocale);

    try {
      const response = await fetch("/api/locale/preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) {
        throw new Error(t("failedToSaveLanguagePreference", nextLocale));
      }
    } catch {
      setError(t("failedToSaveLanguagePreference", nextLocale));
    }
  }

  const otherLocale = locales.find((l) => l !== locale) ?? "en";
  const triggerLabel = `${localeLabels[locale]} / ${localeLabels[otherLocale]}`;
  const ariaLabel = `${t("currentLanguage", locale)}: ${localeLabels[locale]}. ${t("changeLanguage", locale)}.`;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "group inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground"
          )}
          aria-label={ariaLabel}
        >
          <LanguagesIcon className="size-4" />
          <span className="hidden sm:inline">{triggerLabel}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          {locales.map((l) => (
            <DropdownMenuItem
              key={l}
              onClick={() => handleSelect(l)}
              aria-current={l === locale ? "true" : undefined}
            >
              {localeLabels[l]}
              {l === locale && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("active", locale)}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <span className="max-w-[16rem] text-right text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
