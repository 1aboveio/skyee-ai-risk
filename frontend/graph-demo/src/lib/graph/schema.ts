import { z } from "zod";

export const riskLevelSchema = z.enum(["HIGH", "MEDIUM_HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

export const graphNodeSchema = z.object({
  custId: z.string(),
  custName: z.string().nullable(),
  riskLevel: riskLevelSchema,
  isHighRisk: z.boolean(),
  isSanctioned: z.boolean(),
  nodeDegree: z.number().int().nonnegative(),
  currentBalance: z.number().nullable(),
});

export const graphEdgeSchema = z.object({
  edgeId: z.string(),
  sourceCustId: z.string(),
  targetCustId: z.string(),
  neighborCustId: z.string(),
  edgeType: z.string(),
  edgeSource: z.string().nullable(),
  strength: z.enum(["Strong", "Weak"]),
  edgeValue: z.string().nullable(),
  recordCount: z.number().int().nonnegative(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
});

export const graphSearchResultSchema = z.object({
  custId: z.string(),
  source: z.enum(["query-service", "mock"]),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  highRiskCustIds: z.array(z.string()),
  stats: z.object({
    nodeCount: z.number().int().nonnegative(),
    edgeCount: z.number().int().nonnegative(),
    strongEdgeCount: z.number().int().nonnegative(),
    weakEdgeCount: z.number().int().nonnegative(),
    highRiskCount: z.number().int().nonnegative(),
  }),
});

export const graphSearchRequestSchema = z.object({
  custId: z.string({ error: "Customer ID is required" }).trim().min(1),
  includeWeak: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphSearchResult = z.infer<typeof graphSearchResultSchema>;
export type GraphSearchRequest = z.infer<typeof graphSearchRequestSchema>;
