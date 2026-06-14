import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { en } from "@/lib/i18n/en";
import { zhCN } from "@/lib/i18n/zh-CN";
import { LocaleProvider, useLocale } from "@/lib/i18n/locale-provider";
import { GraphDemo } from "./graph-demo";
import { getMockGraph } from "@/lib/graph/mock-data";

// @covers components/graph/graph-demo
// @level functional

function LocaleController() {
  const { setLocale } = useLocale();
  return (
    <div>
      <button type="button" onClick={() => setLocale("en")}>
        Switch to English
      </button>
      <button type="button" onClick={() => setLocale("zh-CN")}>
        Switch to Chinese
      </button>
    </div>
  );
}

function renderWithLocale(locale: "en" | "zh-CN" = "en") {
  return render(
    <LocaleProvider initialLocale={locale}>
      <LocaleController />
      <GraphDemo />
    </LocaleProvider>
  );
}

function mockGraphFetch() {
  const graph = getMockGraph("1000321", true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(graph),
    } as Response)
  );
}

describe("GraphDemo global locale", () => {
  beforeEach(() => {
    mockGraphFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders English graph labels and no module-local language toggle", async () => {
    renderWithLocale("en");

    await waitFor(() => {
      expect(screen.getByText(en.customerGraph)).toBeInTheDocument();
    });

    expect(screen.getByText(en.relationshipSearch)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.search })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: en.includeWeak })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: en.table }));

    const table = screen.getByRole("table");
    expect(within(table).getByText(en.customerId)).toBeInTheDocument();
    expect(within(table).getByText(en.risk)).toBeInTheDocument();
    expect(within(table).getByText(en.accountBalance)).toBeInTheDocument();
    expect(within(table).getByText(en.link)).toBeInTheDocument();
    expect(within(table).getByText(en.strength)).toBeInTheDocument();
    expect(within(table).getByText(en.records)).toBeInTheDocument();
    expect(within(table).getByText(en.lastSeen)).toBeInTheDocument();

    // Old in-card language toggle is gone.
    expect(screen.queryByRole("button", { name: "中文" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
  });

  it("renders Chinese graph labels", async () => {
    renderWithLocale("zh-CN");

    await waitFor(() => {
      expect(screen.getByText(zhCN.customerGraph)).toBeInTheDocument();
    });

    expect(screen.getByText(zhCN.relationshipSearch)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: zhCN.search })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: zhCN.includeWeak })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: zhCN.table }));

    const table = screen.getByRole("table");
    expect(within(table).getByText(zhCN.customerId)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.risk)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.accountBalance)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.link)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.strength)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.records)).toBeInTheDocument();
    expect(within(table).getByText(zhCN.lastSeen)).toBeInTheDocument();
  });

  it("updates graph labels immediately when the global locale changes", async () => {
    renderWithLocale("en");

    await waitFor(() => {
      expect(screen.getByText(en.customerGraph)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    await waitFor(() => {
      expect(screen.getByText(zhCN.customerGraph)).toBeInTheDocument();
    });

    expect(screen.getByText(zhCN.relationshipSearch)).toBeInTheDocument();
    expect(screen.queryByText(en.customerGraph)).not.toBeInTheDocument();
  });

  it("localizes edge type labels based on the active locale", async () => {
    renderWithLocale("en");

    await waitFor(() => {
      expect(screen.getByText(en.customerGraph)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: en.table }));

    const table = screen.getByRole("table");
    expect(within(table).getByText("Same Mobile Phone")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));

    await waitFor(() => {
      expect(within(table).getByText("同卡/同手机号")).toBeInTheDocument();
    });

    expect(within(table).queryByText("Same Mobile Phone")).not.toBeInTheDocument();
  });

  it("does not translate source evidence values", async () => {
    renderWithLocale("zh-CN");

    await waitFor(() => {
      expect(screen.getByText(zhCN.customerGraph)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: zhCN.table }));

    const table = screen.getByRole("table");
    await waitFor(() => {
      expect(within(table).getByText("1000834")).toBeInTheDocument();
    });
    expect(within(table).getByText("Blue Harbor Imports")).toBeInTheDocument();
    expect(within(table).getByText(/\+86 755 8291 0041/)).toBeInTheDocument();
    expect(within(table).getByText("183.62.112.94")).toBeInTheDocument();
    expect(within(table).getByText("https://shop.example.net/aster")).toBeInTheDocument();
  });

  it("formats dates and money according to the active locale", async () => {
    renderWithLocale("zh-CN");

    await waitFor(() => {
      expect(screen.getByText(zhCN.customerGraph)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: zhCN.table }));

    const table = screen.getByRole("table");
    // zh-CN date formatting includes full-width slash separators.
    expect(within(table).getByText(/2026\/06\/10/)).toBeInTheDocument();
    // Number formatting still groups with commas and keeps two decimals in zh-CN.
    expect(within(table).getByText("3,200.00")).toBeInTheDocument();
  });
});
