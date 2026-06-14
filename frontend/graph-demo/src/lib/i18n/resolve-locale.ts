export type Locale = "en" | "zh-CN";

export const locales: Locale[] = ["en", "zh-CN"];
export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

function parsePrimaryLanguage(header: string): string {
  return header
    .split(",")[0]
    .split(";")[0]
    .trim()
    .toLowerCase();
}

export function resolveLocale(
  preference: Locale | null | undefined,
  acceptLanguage: string | null | undefined
): Locale {
  if (isLocale(preference)) {
    return preference;
  }

  const primary = acceptLanguage ? parsePrimaryLanguage(acceptLanguage) : "";
  const primarySubtag = primary.split("-")[0];

  if (primarySubtag === "zh") {
    return "zh-CN";
  }

  if (primarySubtag === "en") {
    return "en";
  }

  return defaultLocale;
}
