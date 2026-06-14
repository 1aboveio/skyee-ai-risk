import { describe, expect, it } from "vitest";
import { en } from "./en";
import { dictionaryKeys } from "./keys";
import { zhCN } from "./zh-CN";

// @covers lib/i18n/dictionaries
// @level unit

describe("dictionaries", () => {
  it("en and zh-CN expose exactly the same message keys", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zhCN).sort();
    expect(enKeys).toEqual(zhKeys);
    expect(enKeys).toEqual([...dictionaryKeys].sort());
  });

  it("every declared key has a non-empty string value in both locales", () => {
    for (const key of dictionaryKeys) {
      expect(en[key], `en.${key}`).toBeTypeOf("string");
      expect(en[key], `en.${key}`).not.toBe("");
      expect(zhCN[key], `zhCN.${key}`).toBeTypeOf("string");
      expect(zhCN[key], `zhCN.${key}`).not.toBe("");
    }
  });
});
