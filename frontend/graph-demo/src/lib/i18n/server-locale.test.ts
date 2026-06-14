import { describe, expect, it, vi } from "vitest";
import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { resolveInitialLocale } from "./server-locale";
import type { Locale } from "./resolve-locale";

// @covers lib/i18n/server-locale
// @level integration

const reviewerId = "reviewer_123";

function makeSession(): GraphIdentitySession {
  return {
    user: {
      id: reviewerId,
      email: "reviewer@skyee360.com",
      name: "Reviewer",
      image: null,
    },
    organization: {
      id: "org_1",
      slug: "skyee",
      name: "Skyee",
    },
    membership: {
      role: "REVIEWER",
      status: "ACTIVE",
    },
    exp: Date.now() + 3600_000,
  };
}

describe("resolveInitialLocale", () => {
  it("uses a stored signed-in preference over the browser language", async () => {
    const getPreference = vi.fn().mockResolvedValue("en" satisfies Locale);

    const locale = await resolveInitialLocale({
      isAuthRoute: false,
      session: makeSession(),
      acceptLanguage: "zh-CN",
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("en");
    expect(getPreference).toHaveBeenCalledWith(reviewerId);
  });

  it("falls back to the browser language when no signed-in preference exists", async () => {
    const getPreference = vi.fn().mockResolvedValue(null);

    const locale = await resolveInitialLocale({
      isAuthRoute: false,
      session: makeSession(),
      acceptLanguage: "zh-CN",
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("zh-CN");
  });

  it("falls back to the default locale when the session has no preference and no accept-language", async () => {
    const getPreference = vi.fn().mockResolvedValue(null);

    const locale = await resolveInitialLocale({
      isAuthRoute: false,
      session: makeSession(),
      acceptLanguage: undefined,
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("zh-CN");
  });

  it("uses browser detection only for auth routes and never reads a stored preference", async () => {
    const getPreference = vi.fn().mockRejectedValue(
      new Error("preference store should not be called")
    );

    const locale = await resolveInitialLocale({
      isAuthRoute: true,
      session: null,
      acceptLanguage: "en",
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("en");
    expect(getPreference).not.toHaveBeenCalled();
  });

  it("ignores a stored preference for auth routes even when a session is present", async () => {
    const getPreference = vi.fn().mockRejectedValue(
      new Error("preference store should not be called")
    );

    const locale = await resolveInitialLocale({
      isAuthRoute: true,
      session: makeSession(),
      acceptLanguage: "en",
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("en");
    expect(getPreference).not.toHaveBeenCalled();
  });

  it("uses browser detection for anonymous signed-out requests", async () => {
    const getPreference = vi.fn().mockRejectedValue(
      new Error("preference store should not be called")
    );

    const locale = await resolveInitialLocale({
      isAuthRoute: false,
      session: null,
      acceptLanguage: "en-US",
      getReviewerLocalePreference: getPreference,
    });

    expect(locale).toBe("en");
    expect(getPreference).not.toHaveBeenCalled();
  });
});
