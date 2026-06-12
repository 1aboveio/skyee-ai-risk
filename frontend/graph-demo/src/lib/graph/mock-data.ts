import type { GraphSearchResult } from "./schema";

export const demoCustomers = [
  "1017587943291126",
  "1149050613598822408",
  "1256596782700343303",
  "101192",
  "642677",
  "1017492268421111",
];

const result: GraphSearchResult = {
  custId: "1000321",
  source: "mock",
  nodes: [
    {
      custId: "1000321",
      custName: "Shenzhen Aster Trading",
      riskLevel: "MEDIUM",
      isHighRisk: false,
      isSanctioned: false,
      nodeDegree: 5,
    },
    {
      custId: "1000834",
      custName: "Blue Harbor Imports",
      riskLevel: "HIGH",
      isHighRisk: true,
      isSanctioned: false,
      nodeDegree: 7,
    },
    {
      custId: "1001410",
      custName: "Ningbo Eastline Supply",
      riskLevel: "MEDIUM_HIGH",
      isHighRisk: true,
      isSanctioned: false,
      nodeDegree: 4,
    },
    {
      custId: "1002097",
      custName: "Luma Global Store",
      riskLevel: "LOW",
      isHighRisk: false,
      isSanctioned: false,
      nodeDegree: 3,
    },
    {
      custId: "1003772",
      custName: "Orchid Settlement Ltd",
      riskLevel: "HIGH",
      isHighRisk: true,
      isSanctioned: true,
      nodeDegree: 6,
    },
    {
      custId: "1004188",
      custName: "Westbridge Logistics",
      riskLevel: "UNKNOWN",
      isHighRisk: false,
      isSanctioned: false,
      nodeDegree: 2,
    },
  ],
  edges: [
    {
      edgeId: "e-phone-1",
      sourceCustId: "1000321",
      targetCustId: "1000834",
      neighborCustId: "1000834",
      edgeType: "SAME_PHONE",
      edgeSource: "stg_cust_customer_info",
      strength: "Strong",
      edgeValue: "+86 755 8291 0041",
      recordCount: 4,
      firstSeen: "2024-03-18T09:11:00Z",
      lastSeen: "2026-06-10T11:04:00Z",
    },
    {
      edgeId: "e-bank-1",
      sourceCustId: "1000321",
      targetCustId: "1001410",
      neighborCustId: "1001410",
      edgeType: "SAME_ID_NO",
      edgeSource: "stg_cust_bank_acct_info",
      strength: "Strong",
      edgeValue: "REF_COMPANY=91440300MA5KYC28X3",
      recordCount: 2,
      firstSeen: "2024-05-22T03:41:00Z",
      lastSeen: "2026-05-31T16:20:00Z",
    },
    {
      edgeId: "e-ip-1",
      sourceCustId: "1000321",
      targetCustId: "1002097",
      neighborCustId: "1002097",
      edgeType: "SAME_IP",
      edgeSource: "stg_cust_user_login_log",
      strength: "Weak",
      edgeValue: "183.62.112.94",
      recordCount: 17,
      firstSeen: "2025-08-02T20:01:00Z",
      lastSeen: "2026-06-11T01:18:00Z",
    },
    {
      edgeId: "e-address-1",
      sourceCustId: "1000321",
      targetCustId: "1003772",
      neighborCustId: "1003772",
      edgeType: "SAME_ADDRESS",
      edgeSource: "stg_cust_enterprise_realname_info",
      strength: "Strong",
      edgeValue: "Futian District, Shenzhen",
      recordCount: 3,
      firstSeen: "2024-01-07T07:32:00Z",
      lastSeen: "2026-04-09T09:00:00Z",
    },
    {
      edgeId: "e-store-1",
      sourceCustId: "1000321",
      targetCustId: "1004188",
      neighborCustId: "1004188",
      edgeType: "SAME_STORE_URL",
      edgeSource: "stg_cust_store_info",
      strength: "Weak",
      edgeValue: "https://shop.example.net/aster",
      recordCount: 1,
      firstSeen: "2026-02-13T12:15:00Z",
      lastSeen: "2026-02-13T12:15:00Z",
    },
  ],
  highRiskCustIds: ["1000834", "1001410", "1003772"],
  stats: {
    nodeCount: 6,
    edgeCount: 5,
    strongEdgeCount: 3,
    weakEdgeCount: 2,
    highRiskCount: 3,
  },
};

export function getMockGraph(custId: string, includeWeak: boolean): GraphSearchResult {
  const edges = includeWeak
    ? result.edges
    : result.edges.filter((edge) => edge.strength === "Strong");
  const nodeIds = new Set([custId, ...edges.map((edge) => edge.neighborCustId)]);
  const nodes = result.nodes
    .filter((node) => nodeIds.has(node.custId))
    .map((node) => (node.custId === result.custId ? { ...node, custId } : node));

  return {
    ...result,
    custId,
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      strongEdgeCount: edges.filter((edge) => edge.strength === "Strong").length,
      weakEdgeCount: edges.filter((edge) => edge.strength === "Weak").length,
      highRiskCount: nodes.filter((node) => node.isHighRisk || node.isSanctioned).length,
    },
  };
}
