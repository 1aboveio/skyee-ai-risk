import { en } from "./en";
import type { DictionaryKey } from "./keys";
import { defaultLocale, type Locale } from "./resolve-locale";
import { zhCN } from "./zh-CN";

export { en, zhCN };
export type { DictionaryKey, Locale };
export { defaultLocale, isLocale, locales, resolveLocale } from "./resolve-locale";

export const dictionaries = {
  en,
  "zh-CN": zhCN,
} as const;

export function t(key: DictionaryKey, locale: Locale): string {
  const dictionary = dictionaries[locale];
  return dictionary[key] ?? dictionaries[defaultLocale][key] ?? key;
}
