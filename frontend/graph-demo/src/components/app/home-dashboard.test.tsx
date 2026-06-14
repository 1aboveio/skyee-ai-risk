import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-provider";
import { HomeDashboard } from "./home-dashboard";

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        简体中文
      </button>
      <span data-testid="current-locale">{locale}</span>
    </div>
  );
}

// @covers components/app/home-dashboard
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
      <LocaleSwitcher />
      <HomeDashboard session={makeSession()} />
    </LocaleProvider>
  );
}

describe("HomeDashboard", () => {
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

  it("renders English homepage copy", () => {
    renderWithLocale("en");

    expect(
      screen.getByRole("heading", { name: en.customerRiskReviewConsole })
    ).toBeInTheDocument();
    expect(screen.getByText(en.homeHeroDescription)).toBeInTheDocument();

    expect(screen.getByText(en.graphNetworkSearch)).toBeInTheDocument();
    expect(
      screen.getByText(en.graphNetworkSearchDescription)
    ).toBeInTheDocument();

    expect(screen.getByText(en.reviewWorkbench)).toBeInTheDocument();
    expect(
      screen.getByText(en.reviewWorkbenchDescription)
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("link", { name: en.openSearch })
    ).toHaveLength(2);

    expect(screen.getByText(en.evidenceBoundary)).toBeInTheDocument();
    expect(screen.getByText(en.graphData)).toBeInTheDocument();
    expect(screen.getByText(en.sourceEvidence)).toBeInTheDocument();
    expect(screen.getByText(en.reviewStore)).toBeInTheDocument();

    expect(screen.getByText(en.workflowPosition)).toBeInTheDocument();
    expect(screen.getByText(en.prescreening)).toBeInTheDocument();
    expect(screen.getByText(en.secondRoundHumanReview)).toBeInTheDocument();
    expect(screen.getByText(en.adHocInvestigation)).toBeInTheDocument();
  });

  it("renders Chinese homepage copy", () => {
    renderWithLocale("zh-CN");

    expect(
      screen.getByRole("heading", { name: zhCN.customerRiskReviewConsole })
    ).toBeInTheDocument();
    expect(screen.getByText(zhCN.homeHeroDescription)).toBeInTheDocument();

    expect(screen.getByText(zhCN.graphNetworkSearch)).toBeInTheDocument();
    expect(
      screen.getByText(zhCN.graphNetworkSearchDescription)
    ).toBeInTheDocument();

    expect(screen.getByText(zhCN.reviewWorkbench)).toBeInTheDocument();
    expect(
      screen.getByText(zhCN.reviewWorkbenchDescription)
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("link", { name: zhCN.openSearch })
    ).toHaveLength(2);

    expect(screen.getByText(zhCN.evidenceBoundary)).toBeInTheDocument();
    expect(screen.getByText(zhCN.graphData)).toBeInTheDocument();
    expect(screen.getByText(zhCN.sourceEvidence)).toBeInTheDocument();
    expect(screen.getByText(zhCN.reviewStore)).toBeInTheDocument();

    expect(screen.getByText(zhCN.workflowPosition)).toBeInTheDocument();
    expect(screen.getByText(zhCN.prescreening)).toBeInTheDocument();
    expect(screen.getByText(zhCN.secondRoundHumanReview)).toBeInTheDocument();
    expect(screen.getByText(zhCN.adHocInvestigation)).toBeInTheDocument();
  });

  it("updates homepage labels when the locale context changes", async () => {
    renderWithLocale("en");

    expect(
      screen.getByRole("heading", { name: en.customerRiskReviewConsole })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "简体中文" }));

    await waitFor(() => {
      expect(screen.getByTestId("current-locale")).toHaveTextContent("zh-CN");
    });

    expect(
      screen.getByRole("heading", { name: zhCN.customerRiskReviewConsole })
    ).toBeInTheDocument();

    expect(screen.getByText(zhCN.homeHeroDescription)).toBeInTheDocument();
    expect(screen.getByText(zhCN.graphNetworkSearch)).toBeInTheDocument();
    expect(screen.getByText(zhCN.reviewWorkbench)).toBeInTheDocument();
  });

  it("does not translate dynamic identity or evidence values", () => {
    renderWithLocale("zh-CN");

    expect(screen.getByText("reviewer@skyee360.com")).toBeInTheDocument();
    expect(screen.getByText("Skyee")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });
});
