import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { AppShell } from "./app-shell";

// @covers components/app/app-shell
// @level unit

function makeSession(): GraphIdentitySession {
  return {
    user: {
      id: "reviewer_123",
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

function renderWithLocale(locale: "en" | "zh-CN") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <AppShell active="home" session={makeSession()}>
        <div data-testid="page-content">Page content</div>
      </AppShell>
    </LocaleProvider>
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ locale: "zh-CN" }),
      } as Response)
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("renders English sidebar navigation labels", () => {
    renderWithLocale("en");

    const primaryNav = screen.getByRole("navigation", {
      name: en.primaryNavigation,
    });
    const links = within(primaryNav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      en.home,
      en.graphNetworkSearch,
      en.reviewWorkbench,
    ]);
  });

  it("renders Chinese sidebar navigation labels", () => {
    renderWithLocale("zh-CN");

    const primaryNav = screen.getByRole("navigation", {
      name: zhCN.primaryNavigation,
    });
    const links = within(primaryNav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      zhCN.home,
      zhCN.graphNetworkSearch,
      zhCN.reviewWorkbench,
    ]);
  });

  it("renders localized signed-in and sign-out labels in English", () => {
    renderWithLocale("en");

    expect(screen.getByText(en.signedIn)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: en.signOut }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders localized signed-in and sign-out labels in Chinese", () => {
    renderWithLocale("zh-CN");

    expect(screen.getByText(zhCN.signedIn)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: zhCN.signOut }).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders localized mobile module navigation labels", () => {
    renderWithLocale("en");

    const mobileNav = screen.getByRole("navigation", {
      name: en.moduleNavigation,
    });
    const links = within(mobileNav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      en.home,
      en.graphNetworkSearch,
      en.reviewWorkbench,
    ]);
  });

  it("updates shell labels when the header language switcher is used", async () => {
    renderWithLocale("en");

    await userEvent.click(
      screen.getAllByRole("button", { name: new RegExp(en.currentLanguage, "i") })[0]
    );

    await waitFor(() => {
      expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    });

    await userEvent.click(screen.getByRole("menuitem", { name: zhCN.simplifiedChinese }));

    await waitFor(() => {
      const primaryNav = screen.getByRole("navigation", {
        name: zhCN.primaryNavigation,
      });
      const links = within(primaryNav).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual([
        zhCN.home,
        zhCN.graphNetworkSearch,
        zhCN.reviewWorkbench,
      ]);
    });

    expect(screen.getByText(zhCN.signedIn)).toBeInTheDocument();
  });

  it("does not translate dynamic identity values", () => {
    renderWithLocale("zh-CN");

    expect(screen.getByText("reviewer@skyee360.com")).toBeInTheDocument();
    expect(screen.getByText("REVIEWER")).toBeInTheDocument();
  });
});
