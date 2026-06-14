export type Locale = "en" | "zh-CN";

export const locales: Locale[] = ["en", "zh-CN"];
export const defaultLocale: Locale = "zh-CN";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

const chinesePrimaryLanguages = new Set([
  "zh",
  "zh-cn",
  "zh-hans",
  "zh-hk",
  "zh-tw",
]);

const englishPrimaryLanguages = new Set(["en", "en-us", "en-gb"]);

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

  if (primary.startsWith("zh") || chinesePrimaryLanguages.has(primary)) {
    return "zh-CN";
  }

  if (primary.startsWith("en") || englishPrimaryLanguages.has(primary)) {
    return "en";
  }

  return defaultLocale;
}
