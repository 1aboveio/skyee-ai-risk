import type { GraphSearchResult } from "./schema";

export interface FetchGraphOptions {
  custId: string;
  includeWeak: boolean;
  signal?: AbortSignal;
}

export async function fetchGraph({
  custId,
  includeWeak,
  signal,
}: FetchGraphOptions): Promise<GraphSearchResult> {
  const params = new URLSearchParams({
    custId,
    includeWeak: String(includeWeak),
    limit: "15",
  });
  const response = await fetch(`/api/graph/search?${params.toString()}`, { signal });
  if (!response.ok) {
    try {
      const body = (await response.json()) as {
        error?: { message?: string; detail?: { node_degree?: number; max_degree?: number } };
      };
      const degree = body.error?.detail?.node_degree;
      const maxDegree = body.error?.detail?.max_degree;
      if (degree && maxDegree) {
        throw new Error(
          `${body.error?.message ?? "Graph query blocked"} Degree ${degree.toLocaleString()} exceeds interactive limit ${maxDegree.toLocaleString()}.`
        );
      }
      throw new Error(body.error?.message ?? `Search failed with status ${response.status}`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Search failed with status ${response.status}`);
    }
  }
  return (await response.json()) as GraphSearchResult;
}
