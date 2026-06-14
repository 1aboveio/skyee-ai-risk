import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";
import { LanguageSwitcher } from "./language-switcher";

// @covers components/app/language-switcher
// @level unit

function renderWithLocale(initialLocale: "en" | "zh-CN" = "en") {
  return render(
    <LocaleProvider initialLocale={initialLocale}>
      <LanguageSwitcher />
    </LocaleProvider>
  );
}

describe("LanguageSwitcher", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ locale: "zh-CN" }),
      } as Response)
    );
  });

  it("renders the current locale label", () => {
    renderWithLocale("en");

    expect(
      screen.getByRole("button", { name: new RegExp(en.currentLanguage, "i") })
    ).toBeInTheDocument();
  });

  it("shows the localized active marker for the current locale", async () => {
    renderWithLocale("en");

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(en.currentLanguage, "i") })
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem").length).toBe(2);
    });

    expect(screen.getByText(en.active)).toBeInTheDocument();
  });

  it("shows the localized active marker in Chinese", async () => {
    renderWithLocale("zh-CN");

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(zhCN.currentLanguage, "i") })
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem").length).toBe(2);
    });

    expect(screen.getByText(zhCN.active)).toBeInTheDocument();
  });

  it("updates the locale client state and calls the preference API when a language is selected", async () => {
    const fetchMock = vi.mocked(global.fetch);
    renderWithLocale("en");

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(en.currentLanguage, "i") })
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem").length).toBe(2);
    });

    await userEvent.click(screen.getByRole("menuitem", { name: "简体中文" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: new RegExp(zhCN.currentLanguage, "i") })
      ).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/locale/preference", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale: "zh-CN" }),
    });
  });

  it("shows the localized non-blocking error when the preference API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Server error" } }),
      } as Response)
    );

    renderWithLocale("en");

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(en.currentLanguage, "i") })
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem").length).toBe(2);
    });

    await userEvent.click(screen.getByRole("menuitem", { name: "简体中文" }));

    await waitFor(() => {
      expect(screen.getByText(zhCN.failedToSaveLanguagePreference)).toBeInTheDocument();
    });

    // The client locale stays updated even when persistence fails.
    expect(
      screen.getByRole("button", { name: new RegExp(zhCN.currentLanguage, "i") })
    ).toBeInTheDocument();
  });

  it("shows the localized fallback error when the preference request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network failure"));

    renderWithLocale("en");

    await userEvent.click(
      screen.getByRole("button", { name: new RegExp(en.currentLanguage, "i") })
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem").length).toBe(2);
    });

    await userEvent.click(screen.getByRole("menuitem", { name: "简体中文" }));

    await waitFor(() => {
      expect(screen.getByText(zhCN.failedToSaveLanguagePreference)).toBeInTheDocument();
    });
  });
});
