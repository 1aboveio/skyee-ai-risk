/**
 * Shared Playwright test fixtures for the Customer Risk Review Workbench.
 *
 * Provides:
 * - Authenticated browser context with a valid session cookie
 * - API route mocking helpers
 * - Test data constants
 */
import { test as base, type Page } from "@playwright/test";
import {
  createTestSessionCookie,
  SESSION_COOKIE_NAME,
} from "./helpers/auth";
import {
  TEST_CUST_ID,
  mockProfile,
  mockRiskSignals,
  mockTransactionSummary,
  mockTransactions,
  mockTransactionsPage2,
  mockFilteredTransactions,
  mockGraphData,
  mockSnapshots,
  mockDecisions,
  emptyTransactions,
} from "./helpers/mock-data";

// Re-export for convenience
export {
  TEST_CUST_ID,
  mockProfile,
  mockRiskSignals,
  mockTransactionSummary,
  mockTransactions,
  mockTransactionsPage2,
  mockFilteredTransactions,
  mockGraphData,
  mockSnapshots,
  mockDecisions,
  emptyTransactions,
};

// ---------------------------------------------------------------------------
// Extended test fixture with authenticated page
// ---------------------------------------------------------------------------

type WorkbenchFixtures = {
  /** Page with a valid auth session cookie pre-set */
  authedPage: Page;
};

export const test = base.extend<WorkbenchFixtures>({
  authedPage: async ({ browser, context }, use) => {
    // Add the session cookie before any navigation
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: createTestSessionCookie(),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: false,
      },
    ]);

    const page = await context.newPage();
    await use(page);
  },
});

export { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// API mocking helpers
// ---------------------------------------------------------------------------

/**
 * Set up default API mocks for a fully-loaded workbench page.
 * Call this after navigating or before goto to intercept client-side fetches.
 */
export async function mockAllApis(page: Page) {
  // Customer Profile
  await page.route("**/api/review/*/profile", (route) =>
    route.fulfill({ json: mockProfile })
  );

  // Risk Signals
  await page.route("**/api/review/*/risk-signals", (route) =>
    route.fulfill({ json: mockRiskSignals })
  );

  // Transaction Summary
  await page.route("**/api/review/*/transactions/summary", (route) =>
    route.fulfill({ json: mockTransactionSummary })
  );

  // Transaction List (default page)
  await page.route("**/api/review/*/transactions?**", (route) => {
    const url = new URL(route.request().url());
    const direction = url.searchParams.get("direction");
    const cursor = url.searchParams.get("cursor");

    if (cursor) {
      return route.fulfill({
        json: { transactions: mockTransactionsPage2, nextCursor: null, hasMore: false },
      });
    }

    if (direction === "INBOUND") {
      return route.fulfill({
        json: { transactions: mockFilteredTransactions, nextCursor: "page2", hasMore: true },
      });
    }

    return route.fulfill({
      json: { transactions: mockTransactions, nextCursor: "page2", hasMore: true },
    });
  });

  // Graph Search
  await page.route("**/api/graph/search**", (route) =>
    route.fulfill({ json: mockGraphData })
  );

  // Snapshots GET
  await page.route("**/api/review/*/snapshots", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: mockSnapshots });
    }
    // POST - save snapshot
    return route.fulfill({
      json: {
        id: "snap-new-" + Date.now(),
        snapshotType: "SNAPSHOT_ONLY",
        note: "E2E test snapshot",
        createdAt: new Date().toISOString(),
      },
    });
  });

  // Decisions GET
  await page.route("**/api/review/*/decisions", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: mockDecisions });
    }
    // POST - submit decision
    return route.fulfill({
      json: {
        id: "decision-new-" + Date.now(),
        decisionType: "ACCEPT",
        note: "E2E test decision",
        snapshotId: "snap-decision-" + Date.now(),
        createdAt: new Date().toISOString(),
      },
    });
  });
}

/**
 * Mock a single API endpoint to return a 500 error.
 * Useful for testing independent panel failure resilience.
 */
export async function mockApiFailure(page: Page, pattern: string) {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 500,
      json: { error: { message: "Simulated service failure" } },
    })
  );
}
