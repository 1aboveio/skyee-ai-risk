/**
 * Mock data for E2E tests.
 *
 * Deterministic test data that matches the API response shapes
 * expected by the review workbench components.
 */

// ---------------------------------------------------------------------------
// Customer Profile
// ---------------------------------------------------------------------------

export const TEST_CUST_ID = "E2E_CUST_001";

export const mockProfile = {
  custId: TEST_CUST_ID,
  custType: "PERSONAL" as const,
  custName: "Zhang Wei",
  enName: "Wei Zhang",
  custMobile: "+86-138-0000-1234",
  email: "zhangwei@example.com",
  registCountry: "CN",
  custStatus: "ACTIVE",
  realnameStatus: "VERIFIED",
  riskLevel: "HIGH",
  riskScore: 82,
  highRisk: true,
  sanctioned: false,
  regTime: "2020-03-15T08:30:00.000Z",
  personal: {
    name: "Zhang Wei",
    enName: "Wei Zhang",
    certType: "ID_CARD",
    certNo: "110101199001011234",
    residenceAddress: "123 Chaoyang District, Beijing, China",
  },
  enterprise: null,
  freshness: {
    mainTable: {
      createTime: "2020-03-15T08:30:00.000Z",
      lastUpdateTime: "2025-06-01T10:00:00.000Z",
    },
    realnameTable: {
      createTime: "2020-03-16T09:00:00.000Z",
      lastUpdateTime: "2025-05-15T14:30:00.000Z",
    },
  },
};

// ---------------------------------------------------------------------------
// Risk Signals
// ---------------------------------------------------------------------------

export const mockRiskSignals = [
  {
    signalType: "HIGH_VELOCITY_TXN",
    label: "High Transaction Velocity",
    value: "42 transactions in 24 hours (threshold: 10)",
    severity: "HIGH" as const,
    source: "transaction_analysis",
    timestamp: "2025-06-10T14:30:00.000Z",
  },
  {
    signalType: "LARGE_CASH_DEPOSIT",
    label: "Large Cash Deposit",
    value: "USD 50,000 single deposit without prior history",
    severity: "CRITICAL" as const,
    source: "aml_monitor",
    timestamp: "2025-06-09T09:15:00.000Z",
  },
  {
    signalType: "NEW_COUNTERPARTY",
    label: "New High-Risk Counterparty",
    value: "First transaction with sanctioned-region entity",
    severity: "MEDIUM" as const,
    source: "network_analysis",
    timestamp: "2025-06-08T16:45:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Transaction Summary
// ---------------------------------------------------------------------------

export const mockTransactionSummary = {
  totalCount: 156,
  currencyBreakdown: {
    USD: { count: 98, amount: 485230.5 },
    CNY: { count: 45, amount: 2150000.0 },
    EUR: { count: 13, amount: 42300.0 },
  },
  dateRange: {
    earliest: "2024-01-15T00:00:00.000Z",
    latest: "2025-06-12T23:59:59.000Z",
  },
  directionBreakdown: {
    inbound: 89,
    outbound: 67,
  },
};

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const mockTransactions = [
  {
    id: "txn-001",
    custId: TEST_CUST_ID,
    orderNo: "ORD-2025-001",
    direction: "INBOUND" as const,
    amount: 15000.0,
    currency: "USD",
    usdAmount: 15000.0,
    fxRate: 1.0,
    fxRateDate: "2025-06-10",
    fxWarning: null,
    counterpartyName: "Acme Corp Ltd",
    counterpartyBank: "Chase Bank",
    status: "COMPLETED",
    paymentTime: "2025-06-10T10:30:00.000Z",
    createTime: "2025-06-10T10:25:00.000Z",
  },
  {
    id: "txn-002",
    custId: TEST_CUST_ID,
    orderNo: "ORD-2025-002",
    direction: "OUTBOUND" as const,
    amount: 50000.0,
    currency: "CNY",
    usdAmount: 6850.0,
    fxRate: 0.137,
    fxRateDate: "2025-06-09",
    fxWarning: null,
    counterpartyName: "Beijing Trading Co",
    counterpartyBank: "ICBC",
    status: "COMPLETED",
    paymentTime: "2025-06-09T14:20:00.000Z",
    createTime: "2025-06-09T14:15:00.000Z",
  },
  {
    id: "txn-003",
    custId: TEST_CUST_ID,
    orderNo: "ORD-2025-003",
    direction: "INBOUND" as const,
    amount: 8500.0,
    currency: "EUR",
    usdAmount: 9180.0,
    fxRate: 1.08,
    fxRateDate: "2025-06-08",
    fxWarning: "Rate date fallback: no rate for 2025-06-08, used 2025-06-07",
    counterpartyName: "Euro Payments GmbH",
    counterpartyBank: "Deutsche Bank",
    status: "PENDING",
    paymentTime: null,
    createTime: "2025-06-08T09:00:00.000Z",
  },
  {
    id: "txn-004",
    custId: TEST_CUST_ID,
    orderNo: "ORD-2025-004",
    direction: "OUTBOUND" as const,
    amount: 25000.0,
    currency: "USD",
    usdAmount: 25000.0,
    fxRate: 1.0,
    fxRateDate: "2025-06-07",
    fxWarning: null,
    counterpartyName: "Global Services Inc",
    counterpartyBank: "Bank of America",
    status: "FAILED",
    paymentTime: null,
    createTime: "2025-06-07T16:45:00.000Z",
  },
];

/** Extra transactions for load-more testing */
export const mockTransactionsPage2 = [
  {
    id: "txn-005",
    custId: TEST_CUST_ID,
    orderNo: "ORD-2025-005",
    direction: "INBOUND" as const,
    amount: 3200.0,
    currency: "USD",
    usdAmount: 3200.0,
    fxRate: 1.0,
    fxRateDate: "2025-06-06",
    fxWarning: null,
    counterpartyName: "Small Transfer Co",
    counterpartyBank: "Wells Fargo",
    status: "COMPLETED",
    paymentTime: "2025-06-06T11:00:00.000Z",
    createTime: "2025-06-06T10:55:00.000Z",
  },
];

/** Filtered transactions (INBOUND only) */
export const mockFilteredTransactions = mockTransactions.filter(
  (t) => t.direction === "INBOUND"
);

// ---------------------------------------------------------------------------
// Graph Data
// ---------------------------------------------------------------------------

export const mockGraphData = {
  custId: TEST_CUST_ID,
  source: "mock",
  nodes: [
    {
      custId: TEST_CUST_ID,
      custName: "Zhang Wei",
      nodeDegree: 2,
      currentBalance: 12000,
      riskLevel: "HIGH" as const,
      isHighRisk: true,
      isSanctioned: false,
    },
    {
      custId: "NEIGHBOR_001",
      custName: "Li Na",
      nodeDegree: 1,
      currentBalance: 3000,
      riskLevel: "MEDIUM" as const,
      isHighRisk: false,
      isSanctioned: false,
    },
    {
      custId: "NEIGHBOR_002",
      custName: "Sanctioned Entity",
      nodeDegree: 1,
      currentBalance: 0,
      riskLevel: "HIGH" as const,
      isHighRisk: true,
      isSanctioned: true,
    },
  ],
  edges: [
    {
      edgeId: "edge-001",
      edgeType: "shared_phone",
      sameAttributeType: "same_mobile_phone",
      attributeLinkType: "PRIMARY_MOBILE",
      edgeSource: "cust_customer_info",
      edgeSourceField: "CUST_MOBILE",
      neighborCustId: "NEIGHBOR_001",
      strength: "Strong" as const,
      edgeValue: "+86-138-0000-1234",
      lastSeen: "2025-06-10T00:00:00.000Z",
    },
    {
      edgeId: "edge-002",
      edgeType: "SAME_NAME_PAYER_MOBILE",
      sameAttributeType: "same_business_name",
      attributeLinkType: "PAYER_MOBILE",
      edgeSource: "pmp_pay_order",
      edgeSourceField: "PAYER_MOBILE",
      neighborCustId: "NEIGHBOR_002",
      strength: "Weak" as const,
      edgeValue: "2 transactions",
      lastSeen: "2025-05-20T00:00:00.000Z",
    },
  ],
  warnings: [],
  stats: {
    nodeCount: 3,
    edgeCount: 2,
    strongEdgeCount: 1,
    weakEdgeCount: 1,
    highRiskCount: 2,
  },
};

// ---------------------------------------------------------------------------
// Review Snapshots (for history)
// ---------------------------------------------------------------------------

export const mockSnapshots = [
  {
    id: "snap-001",
    sessionId: "session-001",
    snapshotType: "SNAPSHOT_ONLY",
    note: "Initial evidence capture for E2E testing",
    createdAt: new Date(Date.now() - 3600_000).toISOString(),
    contextType: "WORKFLOW_HUMAN_REVIEW",
    reviewerEmail: "e2e-tester@skyee360.com",
  },
];

// ---------------------------------------------------------------------------
// Decisions (for history)
// ---------------------------------------------------------------------------

export const mockDecisions: Array<{
  id: string;
  sessionId: string;
  decisionType: string;
  note: string;
  snapshotId: string | null;
  createdAt: string;
  contextType: string;
  reviewerEmail: string;
}> = [];

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

export const emptyTransactions = {
  transactions: [],
  nextCursor: null,
  hasMore: false,
};
