import { GRAPH_SESSION_COOKIE, parseSessionValue } from "@/lib/auth/identity-session";
import { graphSearchRequestSchema } from "@/lib/graph/schema";
import { GraphServiceError, searchCustomerGraph } from "@/lib/graph/query-service";

export async function GET(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GRAPH_SESSION_COOKIE}=`))
    ?.slice(GRAPH_SESSION_COOKIE.length + 1);
  const session = parseSessionValue(
    sessionCookie ? decodeURIComponent(sessionCookie) : undefined
  );
  if (!session) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in with Identity before searching the graph.",
        },
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  const requestPayload = {
    ...searchParams,
    sameAttributeType:
      searchParams.same_attribute_type ?? searchParams.sameAttributeType,
  };

  const parsed = graphSearchRequestSchema.safeParse(requestPayload);

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
