import { getMockGraph } from "./mock-data";
import type { GraphEdge, GraphNode, GraphSearchRequest, GraphSearchResult } from "./schema";

type ServiceNeighbor = {
  neighbor_cust_id: number | string;
  cust_name?: string | null;
  risk_level?: string | null;
  is_high_risk?: string | boolean | null;
  is_sanctioned?: string | boolean | null;
  node_degree?: number | null;
  edge_id?: number | string | null;
  source_cust_id?: number | string | null;
  target_cust_id?: number | string | null;
  edge_type?: string | null;
  edge_source?: string | null;
  strength?: string | null;
  edge_value?: string | null;
  record_count?: number | null;
  first_seen?: string | null;
  last_seen?: string | null;
};

type ServiceHighRisk = {
  cust_id: number | string;
};

type ServiceDegree = {
  cust_id: number | string;
  node_degree?: number | null;
};

type ServiceErrorDetail =
  | string
  | {
      code?: string;
      message?: string;
      cust_id?: number | string;
      node_degree?: number;
      max_degree?: number;
    };

export class GraphServiceError extends Error {
  status: number;
  detail: ServiceErrorDetail | null;

  constructor(status: number, detail: ServiceErrorDetail | null) {
    const message =
      typeof detail === "object" && detail?.message
        ? detail.message
        : `Graph query service returned ${status}`;
    super(message);
    this.name = "GraphServiceError";
    this.status = status;
    this.detail = detail;
  }
}

function toBoolean(value: ServiceNeighbor["is_high_risk"]): boolean {
  return value === true || value === "Y" || value === "true" || value === "1";
}

function riskLevel(value: string | null | undefined): GraphNode["riskLevel"] {
  if (value === "HIGH_RISK") {
    return "HIGH";
  }
  if (value === "MEDIUM_RISK") {
    return "MEDIUM";
  }
  if (value === "LOW_RISK") {
    return "LOW";
  }
  if (
    value === "HIGH" ||
    value === "MEDIUM_HIGH" ||
    value === "MEDIUM" ||
    value === "LOW"
  ) {
    return value;
  }
  return "UNKNOWN";
}

function strength(value: string | null | undefined): GraphEdge["strength"] {
  return value === "Weak" ? "Weak" : "Strong";
}

async function serviceGet<T>(baseUrl: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    let detail: ServiceErrorDetail | null = null;
    try {
      const body = (await response.json()) as { detail?: ServiceErrorDetail };
      detail = body.detail ?? null;
    } catch {
      detail = null;
    }
    throw new GraphServiceError(response.status, detail);
  }
  return (await response.json()) as T;
}

function normalizeServiceResult(
  input: GraphSearchRequest,
  neighbors: ServiceNeighbor[],
  highRisk: ServiceHighRisk[],
  degree: ServiceDegree | null
): GraphSearchResult {
  const highRiskIds = new Set(highRisk.map((node) => String(node.cust_id)));
  const filtered = input.includeWeak
    ? neighbors
    : neighbors.filter((edge) => strength(edge.strength) === "Strong");

  const center: GraphNode = {
    custId: input.custId,
    custName: "Selected customer",
    riskLevel: "UNKNOWN",
    isHighRisk: false,
    isSanctioned: false,
    nodeDegree: degree?.node_degree ?? filtered.length,
  };

  const nodes: GraphNode[] = [
    center,
    ...filtered.map((item) => {
      const custId = String(item.neighbor_cust_id);
      return {
        custId,
        custName: item.cust_name ?? null,
        riskLevel: riskLevel(item.risk_level),
        isHighRisk: toBoolean(item.is_high_risk) || highRiskIds.has(custId),
        isSanctioned: toBoolean(item.is_sanctioned),
        nodeDegree: item.node_degree ?? 0,
      };
    }),
  ];

  const edges = filtered.map((item, index): GraphEdge => {
    const neighborCustId = String(item.neighbor_cust_id);
    const low = String(item.source_cust_id ?? input.custId);
    const high = String(item.target_cust_id ?? neighborCustId);
    return {
      edgeId: String(item.edge_id ?? `${low}-${high}-${index}`),
      sourceCustId: low,
      targetCustId: high,
      neighborCustId,
      edgeType: item.edge_type ?? "UNKNOWN",
      edgeSource: item.edge_source ?? null,
      strength: strength(item.strength),
      edgeValue: item.edge_value ?? null,
      recordCount: item.record_count ?? 0,
      firstSeen: item.first_seen ?? null,
      lastSeen: item.last_seen ?? null,
    };
  });

  return {
    custId: input.custId,
    source: "query-service",
    nodes,
    edges,
    highRiskCustIds: [...highRiskIds],
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      strongEdgeCount: edges.filter((edge) => edge.strength === "Strong").length,
      weakEdgeCount: edges.filter((edge) => edge.strength === "Weak").length,
      highRiskCount: nodes.filter((node) => node.isHighRisk || node.isSanctioned).length,
    },
  };
}

export async function searchCustomerGraph(
  input: GraphSearchRequest
): Promise<GraphSearchResult> {
  const baseUrl = process.env.GRAPH_QUERY_BASE_URL;

  if (!baseUrl) {
    return getMockGraph(input.custId, input.includeWeak);
  }

  const params = new URLSearchParams({ limit: String(input.limit) });
  const [neighbors, highRisk, degree] = await Promise.all([
    serviceGet<ServiceNeighbor[]>(
      baseUrl,
      `/neighbors/${encodeURIComponent(input.custId)}?${params.toString()}`
    ),
    serviceGet<ServiceHighRisk[]>(
      baseUrl,
      `/high-risk/${encodeURIComponent(input.custId)}?${params.toString()}`
    ),
    serviceGet<ServiceDegree>(
      baseUrl,
      `/degree/${encodeURIComponent(input.custId)}`
    ),
  ]);
  return normalizeServiceResult(input, neighbors, highRisk, degree);
}
