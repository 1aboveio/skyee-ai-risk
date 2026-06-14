import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  resolveLocale,
  type Locale,
} from "./resolve-locale";

// @covers lib/i18n/resolve-locale
// @level unit

describe("resolveLocale", () => {
  it("returns a valid preference when provided", () => {
    expect(resolveLocale("en", "zh-CN")).toBe("en");
    expect(resolveLocale("zh-CN", "en-US")).toBe("zh-CN");
  });

  it("ignores invalid preferences and falls back to accept-language", () => {
    expect(resolveLocale("fr" as Locale, "en-US")).toBe("en");
    expect(resolveLocale("invalid" as Locale, "zh-CN")).toBe("zh-CN");
  });

  it("maps Chinese primary languages to zh-CN", () => {
    const variants = ["zh", "zh-CN", "zh-Hans", "zh-HK", "zh-TW"];
    for (const variant of variants) {
      expect(resolveLocale(undefined, variant)).toBe("zh-CN");
      expect(resolveLocale(undefined, variant.toLowerCase())).toBe("zh-CN");
      expect(resolveLocale(undefined, variant.toUpperCase())).toBe("zh-CN");
    }
  });

  it("maps English primary languages to en", () => {
    const variants = ["en", "en-US", "en-GB"];
    for (const variant of variants) {
      expect(resolveLocale(undefined, variant)).toBe("en");
      expect(resolveLocale(undefined, variant.toLowerCase())).toBe("en");
      expect(resolveLocale(undefined, variant.toUpperCase())).toBe("en");
    }
  });

  it("parses the first accept-language entry when quality values are present", () => {
    expect(resolveLocale(undefined, "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh-CN");
    expect(resolveLocale(undefined, "en-US,en;q=0.9,zh-CN;q=0.8")).toBe("en");
  });

  it("falls back to the default locale for unsupported or absent languages", () => {
    expect(resolveLocale(undefined, "fr-FR")).toBe(defaultLocale);
    expect(resolveLocale(undefined, "ja-JP")).toBe(defaultLocale);
    expect(resolveLocale(undefined, "*")).toBe(defaultLocale);
    expect(resolveLocale(undefined, "")).toBe(defaultLocale);
    expect(resolveLocale(undefined, undefined)).toBe(defaultLocale);
    expect(resolveLocale(undefined, null)).toBe(defaultLocale);
    expect(resolveLocale(null, undefined)).toBe(defaultLocale);
    expect(resolveLocale(undefined, "eng")).toBe(defaultLocale);
    expect(resolveLocale(undefined, "english")).toBe(defaultLocale);
    expect(resolveLocale(undefined, "zhongwen")).toBe(defaultLocale);
  });
});
