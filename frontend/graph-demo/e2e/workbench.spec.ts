/**
 * E2E tests for the Customer Risk Review Workbench.
 *
 * @covers /review/[custId]
 * @level functional
 *
 * Tests 15 scenarios covering:
 *   - Page load and panel rendering
 *   - Snapshot save flow
 *   - Decision submit (accept/reject)
 *   - Transaction filters and pagination
 *   - Error resilience (independent panel failure)
 *   - No-AI recommendation invariant
 *   - FX warning display
 */
import {
  test,
  expect,
  mockAllApis,
  TEST_CUST_ID,
  mockProfile,
} from "./fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REVIEW_URL = `/review/${TEST_CUST_ID}`;

/** Navigate to the workbench with all APIs mocked. */
async function gotoWorkbench(page: import("@playwright/test").Page) {
  await mockAllApis(page);
  await page.goto(REVIEW_URL);
  // Wait for the main heading to confirm the page rendered
  await expect(
    page.getByRole("heading", { name: /Customer Risk Review Workbench/i })
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// 1. Enter cust_id -> workbench loads
// ---------------------------------------------------------------------------

// @covers /review/[custId]
// @level smoke
test.describe("Workbench page load", () => {
  test("1. navigating to /review/[custId] renders the workbench", async ({
    authedPage: page,
  }) => {
    await mockAllApis(page);
    await page.goto(REVIEW_URL);

    // Heading visible
    await expect(
      page.getByRole("heading", { name: /Customer Risk Review Workbench/i })
    ).toBeVisible();

    // Customer ID badge visible
    await expect(page.getByText(TEST_CUST_ID)).toBeVisible();

    // Save Snapshot button visible
    await expect(
      page.getByRole("button", { name: /Save Snapshot/i })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Save ad hoc snapshot
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> save-snapshot
// @level functional
test.describe("Save snapshot", () => {
  test("2. clicking Save Snapshot, adding a note, saves and shows in history", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Open snapshot dialog
    await page.getByRole("button", { name: /Save Snapshot/i }).click();

    // Wait for dialog to appear
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText(/Save Review Snapshot/i)
    ).toBeVisible();

    // Type a note
    const noteInput = page.getByRole("dialog").getByLabel(/Note/i);
    await noteInput.fill("E2E snapshot test note");

    // Click Save Snapshot button inside the dialog
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Save Snapshot/i })
      .click();

    // Verify success message
    await expect(
      page.getByText(/Snapshot saved successfully/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Customer Profile panel loads
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> customer-profile-panel
// @level functional
test.describe("Customer Profile panel", () => {
  test("3. profile panel shows customer data when API returns data", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Panel title visible (CardTitle renders as div, not heading)
    await expect(page.getByText("Customer Profile").first()).toBeVisible();

    // Customer name from mock data (appears in heading, paragraph, and title)
    await expect(page.getByText(mockProfile.custName!).first()).toBeVisible();

    // Risk level badge
    await expect(page.getByText(mockProfile.riskLevel!).first()).toBeVisible();

    // Country
    await expect(page.getByText(mockProfile.registCountry!).first()).toBeVisible();
  });

  test("3b. profile panel shows empty state when API returns 404", async ({
    authedPage: page,
  }) => {
    // Override profile mock to return 404
    await page.route("**/api/review/*/profile", (route) =>
      route.fulfill({ status: 404, json: null })
    );
    await mockAllApis(page);
    // Re-apply profile override after mockAllApis (route order matters)
    await page.unroute("**/api/review/*/profile");
    await page.route("**/api/review/*/profile", (route) =>
      route.fulfill({ status: 404, json: null })
    );

    await page.goto(REVIEW_URL);
    await expect(
      page.getByRole("heading", { name: /Customer Risk Review Workbench/i })
    ).toBeVisible();

    // Profile panel shows empty state
    await expect(
      page.getByText(
        /Customer profile data will be loaded from the Source Evidence Database/i
      )
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Risk Signals panel loads
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> risk-signals-panel
// @level functional
test.describe("Risk Signals panel", () => {
  test("4. risk signals panel shows signals when API returns data", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Panel title visible (CardTitle renders as div, not heading)
    await expect(page.getByText("Risk Signals").first()).toBeVisible();

    // Signals count
    await expect(page.getByText(/3 signals found/i)).toBeVisible();

    // First signal label from mock
    await expect(
      page.getByText(/High Transaction Velocity/i)
    ).toBeVisible();

    // Severity badge
    await expect(page.getByText("HIGH").first()).toBeVisible();
  });

  test("4b. risk signals panel shows empty state when API returns empty", async ({
    authedPage: page,
  }) => {
    // Set up all mocks first, then override risk-signals to return empty
    await mockAllApis(page);
    await page.unroute("**/api/review/*/risk-signals");
    await page.route("**/api/review/*/risk-signals", (route) =>
      route.fulfill({ json: [] })
    );

    await page.goto(REVIEW_URL);
    await expect(
      page.getByRole("heading", { name: /Customer Risk Review Workbench/i })
    ).toBeVisible();

    // Empty state message
    await expect(
      page.getByText(/No risk signals found for this customer/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Transaction List loads
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> transaction-list-panel
// @level functional
test.describe("Transaction List", () => {
  test("5. transaction list shows data when API returns transactions", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Panel title visible (CardTitle renders as div, not heading)
    await expect(page.getByText("Transaction List").first()).toBeVisible();

    // First transaction counterparty from mock
    await expect(page.getByText("Acme Corp Ltd")).toBeVisible();

    // Direction badge
    await expect(page.getByText("INBOUND").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Transaction filters work
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> transaction-filters
// @level functional
test.describe("Transaction filters", () => {
  test("6. applying direction filter updates transaction results", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Wait for transactions to load
    await expect(page.getByText("Acme Corp Ltd")).toBeVisible();

    // Select Inbound direction (using the combobox role since label may not match)
    await page.getByRole("combobox").selectOption("INBOUND");

    // Wait for filtered results
    // Only inbound transactions should show (Acme Corp and Euro Payments)
    await expect(page.getByText("Acme Corp Ltd")).toBeVisible();

    // Outbound transactions should NOT be visible
    await expect(
      page.getByText("Beijing Trading Co")
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Transaction Load More
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> transaction-list-panel -> load-more
// @level functional
test.describe("Transaction Load More", () => {
  test("7. clicking Load More appends new transactions", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Wait for initial transactions
    await expect(page.getByText("Acme Corp Ltd")).toBeVisible();

    // Load More button should be visible (hasMore = true)
    const loadMoreBtn = page.getByRole("button", { name: /Load More/i });
    await expect(loadMoreBtn).toBeVisible();

    // Page 2 transaction should not be visible yet
    await expect(
      page.getByText("Small Transfer Co")
    ).not.toBeVisible();

    // Click Load More
    await loadMoreBtn.click();

    // Page 2 transaction should now appear
    await expect(page.getByText("Small Transfer Co")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Risk Graph panel loads
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> risk-graph-panel
// @level functional
test.describe("Risk Graph panel", () => {
  test("8. graph panel renders with nodes and edges from API", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Panel title visible (CardTitle renders as div, not heading)
    await expect(page.getByText("Risk Graph").first()).toBeVisible();

    // Node/edge counts visible
    await expect(page.getByText("3 nodes")).toBeVisible();
    await expect(page.getByText("2 edges")).toBeVisible();

    // Metric cards visible
    await expect(page.getByText("Nodes").first()).toBeVisible();
    await expect(page.getByText("High Risk").first()).toBeVisible();

    // Tab navigation present
    await expect(page.getByRole("tab", { name: /Graph/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Edges/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Nodes/i })).toBeVisible();

    await expect(page.getByText("High-risk enrichment unavailable")).toBeVisible();

    await page.getByRole("tab", { name: /Edges/i }).click();
    const row = page.locator("tbody tr", { hasText: "+86-138-0000-1234" });
    await expect(row.getByText("Same Mobile Phone")).toBeVisible();
    await row.getByRole("button", { name: /Provenance/i }).hover();
    await expect(page.getByText("Attribute link: PRIMARY_MOBILE")).toBeVisible();
    await expect(page.getByText("Field: cust_customer_info.CUST_MOBILE")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 9. Decision panel shows for workflow context
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> decision-panel
// @level functional
test.describe("Decision panel visibility", () => {
  test("9. Accept and Reject buttons visible for WORKFLOW_HUMAN_REVIEW context", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Decision panel title visible (CardTitle renders as div, not heading)
    await expect(page.getByText("Decision").first()).toBeVisible();

    // Context badge
    await expect(page.getByText("WORKFLOW_HUMAN_REVIEW").first()).toBeVisible();

    // Accept button visible
    await expect(
      page.getByRole("button", { name: /Accept/i })
    ).toBeVisible();

    // Reject button visible
    await expect(
      page.getByRole("button", { name: /Reject/i })
    ).toBeVisible();

    // Note input visible
    await expect(page.getByLabel(/Note/i).last()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 10. Submit Accept decision
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> decision-panel -> accept
// @level functional
test.describe("Accept decision", () => {
  test("10. adding note and clicking Accept submits and shows success", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Fill in the decision note
    const noteInput = page.getByLabel(/Note/i).last();
    await noteInput.fill("Reviewed evidence, customer is legitimate");

    // Click Accept
    await page.getByRole("button", { name: /Accept/i }).click();

    // Success message appears
    await expect(
      page.getByText(/Accepted successfully/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 11. Submit Reject decision
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> decision-panel -> reject
// @level functional
test.describe("Reject decision", () => {
  test("11. adding note and clicking Reject submits and shows success", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Fill in the decision note
    const noteInput = page.getByLabel(/Note/i).last();
    await noteInput.fill("Suspicious activity confirmed, escalating to compliance");

    // Click Reject
    await page.getByRole("button", { name: /Reject/i }).click();

    // Success message appears
    await expect(
      page.getByText(/Rejected successfully/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 12. Empty note validation
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> decision-panel -> validation
// @level functional
test.describe("Empty note validation", () => {
  test("12. submitting decision without note shows validation error", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // Buttons should be disabled when note is empty
    const acceptBtn = page.getByRole("button", { name: /Accept/i });
    const rejectBtn = page.getByRole("button", { name: /Reject/i });

    // Both buttons disabled (note is empty)
    await expect(acceptBtn).toBeDisabled();
    await expect(rejectBtn).toBeDisabled();

    // Helper text visible
    await expect(
      page.getByText(/A note is mandatory for all decisions/i)
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 13. No AI recommendation visible
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> no-ai-invariant
// @level functional
test.describe("No AI recommendation", () => {
  test("13. no AI-generated recommendation or suggestion visible on page", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // These strings should NOT appear anywhere on the page
    const aiIndicators = [
      /AI recommend/i,
      /AI suggest/i,
      /automated decision/i,
      /machine learning/i,
      /model prediction/i,
      /confidence score/i,
      /AI-generated/i,
    ];

    for (const indicator of aiIndicators) {
      await expect(page.getByText(indicator)).toHaveCount(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 14. Independent panel failure
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> resilience
// @level functional
test.describe("Independent panel failure", () => {
  test("14. when profile API fails, other panels still load", async ({
    authedPage: page,
  }) => {
    // Set up all mocks first, then override profile to fail
    await mockAllApis(page);
    await page.unroute("**/api/review/*/profile");
    await page.route("**/api/review/*/profile", (route) =>
      route.fulfill({
        status: 500,
        json: { error: { message: "Database unavailable" } },
      })
    );

    await page.goto(REVIEW_URL);
    await expect(
      page.getByRole("heading", { name: /Customer Risk Review Workbench/i })
    ).toBeVisible();

    // Profile panel shows error state (the WorkbenchPanel error message)
    await expect(page.getByText("Customer Profile").first()).toBeVisible();
    await expect(page.getByText(/Error/i).first()).toBeVisible();

    // Risk Signals panel still loads successfully
    await expect(page.getByText("Risk Signals").first()).toBeVisible();
    await expect(page.getByText(/3 signals found/i)).toBeVisible();

    // Graph panel still loads
    await expect(page.getByText("Risk Graph").first()).toBeVisible();
    await expect(page.getByText("3 nodes")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 15. FX warning display
// ---------------------------------------------------------------------------

// @covers /review/[custId] -> fx-warning
// @level functional
test.describe("FX warning display", () => {
  test("15. FX warning shown for transactions with fxWarning field", async ({
    authedPage: page,
  }) => {
    await gotoWorkbench(page);

    // The EUR transaction (txn-003) has an fxWarning
    // Find the row containing "Euro Payments GmbH"
    const row = page.locator("tr", { hasText: "Euro Payments GmbH" });

    // The FX warning indicator should be visible in that row
    await expect(row.getByTitle(/Rate date fallback/i)).toBeVisible();
    await expect(row.getByText("Warning")).toBeVisible();
  });
});
