import { getMockGraph } from "./mock-data";
import type {
  GraphEdge,
  GraphNode,
  GraphSearchRequest,
  GraphSearchResult,
  SameAttributeType,
} from "./schema";
import { sameAttributeTypeSchema } from "./schema";

type ServiceNeighbor = {
  neighbor_cust_id: number | string;
  cust_name?: string | null;
  risk_level?: string | null;
  is_high_risk?: string | boolean | null;
  is_sanctioned?: string | boolean | null;
  node_degree?: number | null;
  current_balance?: number | string | null;
  edge_id?: number | string | null;
  source_cust_id?: number | string | null;
  target_cust_id?: number | string | null;
  edge_type?: string | null;
  same_attribute_type?: string | null;
  attr_link_type?: string | null;
  edge_source?: string | null;
  edge_source_field?: string | null;
  strength?: string | null;
  edge_value?: string | null;
  record_count?: number | string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  enrichment_status?: string | null;
  enrichment_error?: string | null;
};

type ServiceHighRisk = {
  cust_id: number | string;
  cust_name?: string | null;
  risk_level?: string | null;
  is_high_risk?: string | boolean | null;
  is_sanctioned?: string | boolean | null;
  current_balance?: number | string | null;
  enrichment_status?: string | null;
  enrichment_error?: string | null;
  edge_type?: string | null;
  same_attribute_type?: string | null;
  attr_link_type?: string | null;
  edge_source?: string | null;
  edge_source_field?: string | null;
  strength?: string | null;
  edge_value?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  record_count?: number | string | null;
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

const legacyEdgeTypeToSameAttribute: Record<string, SameAttributeType> = {
  SAME_PHONE: "same_mobile_phone",
  SAME_EMAIL: "same_email",
  SAME_ENTITY_NAME: "same_business_name",
  SAME_PERSON_NAME: "same_person_name",
  SAME_ID_NO: "same_id_no",
  SAME_ADDRESS: "same_address",
  SAME_STORE_URL: "same_store_url",
  SAME_IP: "same_ip",
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

function decimalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSameAttributeType(value: string | null | undefined): SameAttributeType | undefined {
  if (!value) {
    return undefined;
  }

  if (sameAttributeTypeSchema.safeParse(value).success) {
    return value as SameAttributeType;
  }

  return legacyEdgeTypeToSameAttribute[value] ?? undefined;
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

function nodeForCenter(input: GraphSearchRequest): GraphNode {
  return {
    custId: input.custId,
    custName: "Selected customer",
    riskLevel: "UNKNOWN",
    isHighRisk: false,
    isSanctioned: false,
    nodeDegree: 0,
    currentBalance: null,
  };
}

function edgeForRow(
  row: ServiceNeighbor,
  index: number,
  input: GraphSearchRequest
): GraphEdge {
  const neighborCustId = String(row.neighbor_cust_id);
  const low = String(row.source_cust_id ?? input.custId);
  const high = String(row.target_cust_id ?? neighborCustId);
  const sameAttributeType = parseSameAttributeType(row.same_attribute_type ?? row.edge_type);

  return {
    edgeId: String(row.edge_id ?? `${low}-${high}-${index}`),
    sourceCustId: low,
    targetCustId: high,
    neighborCustId,
    edgeType: row.edge_type ?? "UNKNOWN",
    sameAttributeType,
    attributeLinkType: row.attr_link_type ?? null,
    edgeSource: row.edge_source ?? null,
    edgeSourceField: row.edge_source_field ?? null,
    strength: strength(row.strength),
    edgeValue: row.edge_value ?? null,
    recordCount: Number(row.record_count ?? 0),
    firstSeen: row.first_seen ?? null,
    lastSeen: row.last_seen ?? null,
  };
}

function normalizeServiceResult(
  input: GraphSearchRequest,
  neighbors: ServiceNeighbor[],
  highRisk: ServiceHighRisk[],
  degree: ServiceDegree | null,
  warnings: string[]
): GraphSearchResult {
  const highRiskIds = new Set(
    highRisk
      .map((node) => String(node.cust_id))
      .concat(
        neighbors
          .filter((edge) => toBoolean(edge.is_high_risk))
          .map((edge) => String(edge.neighbor_cust_id))
      )
  );

  const filtered = input.includeWeak
    ? neighbors
    : neighbors.filter((edge) => strength(edge.strength) === "Strong");

  const edges = filtered.map((item, index) => edgeForRow(item, index, input));

  const center = nodeForCenter(input);
  const nodeByCustId = new Map<string, GraphNode>();
  for (const item of filtered) {
    const custId = String(item.neighbor_cust_id);
    const existing = nodeByCustId.get(custId);
    const isHighRisk = toBoolean(item.is_high_risk) || highRiskIds.has(custId);
    const isSanctioned = toBoolean(item.is_sanctioned);
    if (existing) {
      existing.isHighRisk = existing.isHighRisk || isHighRisk;
      existing.isSanctioned = existing.isSanctioned || isSanctioned;
      existing.nodeDegree = Math.max(existing.nodeDegree, Number(item.node_degree ?? 0));
      continue;
    }
    nodeByCustId.set(custId, {
      custId,
      custName: item.cust_name ?? null,
      riskLevel: riskLevel(item.risk_level),
      isHighRisk,
      isSanctioned,
      nodeDegree: Number(item.node_degree ?? 0),
      currentBalance: decimalNumber(item.current_balance),
      enrichmentStatus: item.enrichment_status ?? null,
      enrichmentError: item.enrichment_error ?? null,
    });
  }
  const nodes: GraphNode[] = [center, ...nodeByCustId.values()];

  const centerNodeDegree = degree?.node_degree;
  if (typeof centerNodeDegree === "number") {
    nodes[0]!.nodeDegree = centerNodeDegree;
  } else {
    nodes[0]!.nodeDegree = new Set(filtered.map((edge) => String(edge.neighbor_cust_id))).size;
  }

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
    warnings,
  };
}

function mergeWarnings(existing: string[], candidate: string) {
  if (!candidate) {
    return existing;
  }
  if (existing.includes(candidate)) {
    return existing;
  }
  return [...existing, candidate];
}

export async function searchCustomerGraph(
  input: GraphSearchRequest
): Promise<GraphSearchResult> {
  const baseUrl = process.env.GRAPH_QUERY_BASE_URL;

  if (!baseUrl) {
    return getMockGraph(input.custId, input.includeWeak);
  }

  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.sameAttributeType) {
    params.set("same_attribute_type", input.sameAttributeType);
  }

  const neighborsPromise = serviceGet<ServiceNeighbor[]>(
    baseUrl,
    `/neighbors/${encodeURIComponent(input.custId)}?${params.toString()}`
  );
  const highRiskPromise = serviceGet<ServiceHighRisk[]>(
    baseUrl,
    `/high-risk/${encodeURIComponent(input.custId)}?${params.toString()}`
  );
  const degreePromise = serviceGet<ServiceDegree>(
    baseUrl,
    `/degree/${encodeURIComponent(input.custId)}`
  );

  const [neighborsResult, highRiskResult, degreeResult] = await Promise.allSettled([
    neighborsPromise,
    highRiskPromise,
    degreePromise,
  ] as const);
  if (neighborsResult.status === "rejected") {
    throw neighborsResult.reason;
  }

  const neighbors = neighborsResult.value;
  let highRisk: ServiceHighRisk[] = [];
  let degree: ServiceDegree | null = null;
  let warnings: string[] = [];

  if (highRiskResult.status === "fulfilled") {
    highRisk = highRiskResult.value;
  } else {
    const reason = highRiskResult.reason;
    if (reason instanceof GraphServiceError && reason.status === 503) {
      warnings = mergeWarnings(
        warnings,
        `High-risk enrichment unavailable: ${reason.message}`
      );
    } else {
      throw reason;
    }
  }

  if (degreeResult.status === "fulfilled") {
    degree = degreeResult.value;
  } else {
    const reason = degreeResult.reason;
    if (reason instanceof GraphServiceError && reason.status === 503) {
      warnings = mergeWarnings(
        warnings,
        `Degree lookup unavailable: ${reason.message}`
      );
    } else {
      warnings = mergeWarnings(warnings, "Degree lookup incomplete; using edge count estimate.");
      degree = null;
    }
  }

  return normalizeServiceResult(input, neighbors, highRisk, degree, warnings);
}
