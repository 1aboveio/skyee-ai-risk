/**
 * E2E tests for the Graph Demo page.
 *
 * @covers /graph-demo
 * @level functional
 */
import { test, expect } from "./fixtures";

const DEMO_GRAPH_DATA = {
  custId: "1000321",
  source: "query-service",
  warnings: [] as string[],
  nodes: [
    {
      custId: "1000321",
      custName: "Shenzhen Aster Trading",
      riskLevel: "MEDIUM" as const,
      isHighRisk: false,
      isSanctioned: false,
      nodeDegree: 3,
      currentBalance: 125430.25,
    },
    {
      custId: "1000834",
      custName: "Blue Harbor Imports",
      riskLevel: "HIGH" as const,
      isHighRisk: true,
      isSanctioned: false,
      nodeDegree: 7,
      currentBalance: 3200,
    },
    {
      custId: "1001410",
      custName: "Ningbo Eastline Supply",
      riskLevel: "MEDIUM_HIGH" as const,
      isHighRisk: true,
      isSanctioned: false,
      nodeDegree: 4,
      currentBalance: 0,
    },
  ],
  edges: [
    {
      edgeId: "e-phone-1",
      edgeType: "SAME_PHONE",
      sameAttributeType: "same_mobile_phone",
      attributeLinkType: "PRIMARY_MOBILE",
      edgeSource: "stg_cust_customer_info",
      edgeSourceField: "CUST_MOBILE",
      sourceCustId: "1000321",
      targetCustId: "1000834",
      neighborCustId: "1000834",
      strength: "Strong" as const,
      edgeValue: "+86 755 8291 0041",
      recordCount: 4,
      firstSeen: "2024-03-18T09:11:00Z",
      lastSeen: "2026-06-10T11:04:00Z",
    },
    {
      edgeId: "e-email-1",
      edgeType: "SAME_EMAIL",
      sameAttributeType: "same_email",
      attributeLinkType: "EMAIL",
      edgeSource: "stg_cust_customer_info",
      edgeSourceField: "EMAIL",
      sourceCustId: "1000321",
      targetCustId: "1001410",
      neighborCustId: "1001410",
      strength: "Weak" as const,
      edgeValue: "zhangwei@example.com",
      recordCount: 2,
      firstSeen: "2025-08-02T20:01:00Z",
      lastSeen: "2026-06-11T01:18:00Z",
    },
  ],
};

const V1_FILTER_LABELS = [
  "Same Address",
  "Same Business Name",
  "Same Email",
  "Same Identity Number",
  "Same IP",
  "Same Mobile Phone",
  "Same Person Name",
  "Same Store URL",
];

function decorateResult(params: {
  sameAttributeType?: string | null;
  warnings?: string[];
}) {
  const { sameAttributeType, warnings } = params;
  const edges =
    sameAttributeType
      ? DEMO_GRAPH_DATA.edges.filter((edge) => edge.sameAttributeType === sameAttributeType)
      : DEMO_GRAPH_DATA.edges;
  const nodeIds = new Set([DEMO_GRAPH_DATA.custId, ...edges.map((edge) => edge.neighborCustId)]);
  const nodes = DEMO_GRAPH_DATA.nodes.filter((node) => nodeIds.has(node.custId));
  return {
    ...DEMO_GRAPH_DATA,
    edges,
    nodes,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      strongEdgeCount: edges.filter((edge) => edge.strength === "Strong").length,
      weakEdgeCount: edges.filter((edge) => edge.strength === "Weak").length,
      highRiskCount: nodes.filter((node) => node.isHighRisk || node.isSanctioned).length,
    },
    warnings: warnings ?? DEMO_GRAPH_DATA.warnings,
  };
}

async function routeMockGraphSearch(page: import("@playwright/test").Page) {
  await page.route("**/api/graph/search**", (route) => {
    const requestUrl = new URL(route.request().url());
    const sameAttributeType = requestUrl.searchParams.get("same_attribute_type");
    route.fulfill({ json: decorateResult({ sameAttributeType, warnings: [] }) });
  });
}

// @covers /graph-demo
// @level functional
test.describe("Graph Demo search and filters", () => {
  test("renders initial graph results and applies same-attribute filters", async ({
    authedPage: page,
  }) => {
    await routeMockGraphSearch(page);
    await page.goto("/");

    // Heading and metric sanity
    await expect(page.getByText("Customer Graph")).toBeVisible();
    await expect(page.getByText("Nodes", { exact: false }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Table" }).click();

    for (const label of V1_FILTER_LABELS) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }

    const mobilePhoneFilter = page.getByRole("button", { name: /^Same Mobile Phone$/ });
    await expect(mobilePhoneFilter).toBeVisible();
    await mobilePhoneFilter.dispatchEvent("click");

    const row = page.locator("tbody tr", { hasText: "Same Mobile Phone" });
    await expect(row).toContainText("+86 755 8291 0041");
    await expect(page.getByRole("table").getByText("zhangwei@example.com")).not.toBeVisible();
  });
});

// @covers /graph-demo -> edge-annotations
// @level functional
test.describe("Graph Demo annotation inspection", () => {
  test("shows provenance details for Same-Attribute links", async ({
    authedPage: page,
  }) => {
    await routeMockGraphSearch(page);
    await page.goto("/");
    await page.getByRole("tab", { name: "Table" }).click();

    const row = page.locator("tbody tr", { hasText: "+86 755 8291 0041" });
    const provenanceButton = row.getByRole("button", { name: /Provenance/i });
    await provenanceButton.hover();
    await expect(page.getByText("Shared phone")).toBeVisible();
    await expect(page.getByText("Attribute link: PRIMARY_MOBILE")).toBeVisible();
    await expect(page.getByText("Field: stg_cust_customer_info.CUST_MOBILE")).toBeVisible();
  });
});

// @covers /graph-demo -> partial-enrichment
// @level functional
test.describe("Graph Demo partial enrichment handling", () => {
  test("renders graph with warning and keeps visible evidence when enrichment is partial", async ({
    authedPage: page,
  }) => {
    await page.route("**/api/graph/search**", (route) => {
      const requestUrl = new URL(route.request().url());
      const sameAttributeType = requestUrl.searchParams.get("same_attribute_type");
      route.fulfill({
        json: decorateResult({
          sameAttributeType,
          warnings: ["Enrichment service returned partial results; some node fields are unavailable."],
        }),
      });
    });
    await page.goto("/");
    await page.getByRole("tab", { name: "Table" }).click();

    await expect(page.getByText("Warnings")).toBeVisible();
    await expect(page.getByText("Enrichment service returned partial results")).toBeVisible();
    await expect(page.getByRole("table").getByText("Same Mobile Phone")).toBeVisible();
  });
});
