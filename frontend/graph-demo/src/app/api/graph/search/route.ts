import { graphSearchRequestSchema } from "@/lib/graph/schema";
import { GraphServiceError, searchCustomerGraph } from "@/lib/graph/query-service";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = graphSearchRequestSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid graph search parameters.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await searchCustomerGraph(parsed.data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof GraphServiceError) {
      return Response.json(
        {
          error: {
            code: "GRAPH_QUERY_ERROR",
            message: error.message,
            detail: error.detail,
          },
        },
        { status: error.status }
      );
    }
    return Response.json(
      {
        error: {
          code: "GRAPH_QUERY_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Graph query service failed.",
        },
      },
      { status: 502 }
    );
  }
}
