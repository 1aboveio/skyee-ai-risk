import { graphSearchRequestSchema } from "@/lib/graph/schema";
import { searchCustomerGraph } from "@/lib/graph/query-service";

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

  const result = await searchCustomerGraph(parsed.data);
  return Response.json(result);
}
