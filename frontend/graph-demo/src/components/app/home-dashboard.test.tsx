import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";
import type { GraphIdentitySession } from "@/lib/auth/identity-session";
import { HomeDashboard } from "./home-dashboard";

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

describe("HomeDashboard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders English homepage copy", () => {
    render(<HomeDashboard session={makeSession()} locale="en" />);

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
    render(<HomeDashboard session={makeSession()} locale="zh-CN" />);

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

  it("does not translate dynamic identity or evidence values", () => {
    render(<HomeDashboard session={makeSession()} locale="zh-CN" />);

    expect(screen.getByText("reviewer@skyee360.com")).toBeInTheDocument();
    expect(screen.getByText("Skyee")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });
});
