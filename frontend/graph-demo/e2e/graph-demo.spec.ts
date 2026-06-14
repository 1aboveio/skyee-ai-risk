/**
 * E2E tests for the Graph Demo page.
 *
 * @covers /graph-demo
 * @level functional
 */
import { createServer, type Server } from "node:http";
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
      targetCustId: "1000834",
      neighborCustId: "1000834",
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

let graphService: Server | null = null;

function sendJson(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: unknown
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function serviceNeighbors(sameAttributeType: string | null) {
  return DEMO_GRAPH_DATA.edges
    .filter((edge) => !sameAttributeType || edge.sameAttributeType === sameAttributeType)
    .map((edge) => {
      const node = DEMO_GRAPH_DATA.nodes.find(
        (candidate) => candidate.custId === edge.neighborCustId
      );
      return {
        neighbor_cust_id: edge.neighborCustId,
        cust_name: node?.custName ?? null,
        risk_level: node?.riskLevel ?? null,
        is_high_risk: node?.isHighRisk ?? false,
        is_sanctioned: node?.isSanctioned ?? false,
        node_degree: node?.nodeDegree ?? 0,
        current_balance: node?.currentBalance ?? null,
        edge_id: edge.edgeId,
        source_cust_id: edge.sourceCustId,
        target_cust_id: edge.targetCustId,
        edge_type: edge.edgeType,
        same_attribute_type: edge.sameAttributeType,
        attr_link_type: edge.attributeLinkType,
        edge_source: edge.edgeSource,
        edge_source_field: edge.edgeSourceField,
        strength: edge.strength,
        edge_value: edge.edgeValue,
        record_count: edge.recordCount,
        first_seen: edge.firstSeen,
        last_seen: edge.lastSeen,
      };
    });
}

test.beforeAll(async () => {
  graphService = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3179");
    if (requestUrl.pathname.startsWith("/neighbors/")) {
      sendJson(
        response,
        200,
        serviceNeighbors(requestUrl.searchParams.get("same_attribute_type"))
      );
      return;
    }
    if (requestUrl.pathname.startsWith("/high-risk/")) {
      sendJson(response, 503, {
        detail: {
          code: "HIGH_RISK_ENRICHMENT_UNAVAILABLE",
          message: "High-risk enrichment unavailable.",
        },
      });
      return;
    }
    if (requestUrl.pathname.startsWith("/degree/")) {
      sendJson(response, 503, {
        detail: {
          code: "DEGREE_UNAVAILABLE",
          message: "Degree lookup unavailable.",
        },
      });
      return;
    }
    sendJson(response, 404, { detail: { message: "Not found." } });
  });
  await new Promise<void>((resolve) => {
    graphService?.listen(3179, "127.0.0.1", resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    graphService?.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

// @covers /api/graph/search -> query-service
// @level integration
test.describe("Graph search API contract", () => {
  test("normalizes same-attribute links and partial enrichment warnings", async ({
    authedPage: page,
  }) => {
    const response = await page.request.get(
      "/api/graph/search?custId=1000321&includeWeak=true&same_attribute_type=same_mobile_phone"
    );
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.source).toBe("query-service");
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({
      sameAttributeType: "same_mobile_phone",
      attributeLinkType: "PRIMARY_MOBILE",
      edgeSource: "stg_cust_customer_info",
      edgeSourceField: "CUST_MOBILE",
    });
    expect(body.nodes).toHaveLength(2);
    expect(body.nodes[0]).toMatchObject({ custId: "1000321", nodeDegree: 1 });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("High-risk enrichment unavailable"),
        expect.stringContaining("Degree lookup unavailable"),
      ])
    );
  });
});

// @covers /graph-demo
// @level functional
test.describe("Graph Demo search and filters", () => {
  test("renders initial graph results and applies same-attribute filters", async ({
    authedPage: page,
  }) => {
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
    await page.goto("/");
    await page.getByRole("tab", { name: "Table" }).click();

    await expect(page.getByText("Warnings")).toBeVisible();
    await expect(page.getByText("High-risk enrichment unavailable")).toBeVisible();
    await expect(page.getByRole("table").getByText("Same Mobile Phone")).toBeVisible();
  });
});
