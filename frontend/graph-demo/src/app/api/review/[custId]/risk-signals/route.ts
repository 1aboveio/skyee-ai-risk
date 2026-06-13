import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
  type GraphIdentitySession,
} from "@/lib/auth/identity-session";
import { getRiskSignals } from "@/lib/evidence/risk-signals";

const MAX_CUST_ID_LENGTH = 64;

function getSessionFromRequest(request: Request): GraphIdentitySession | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GRAPH_SESSION_COOKIE}=`))
    ?.slice(GRAPH_SESSION_COOKIE.length + 1);
  return parseSessionValue(
    sessionCookie ? decodeURIComponent(sessionCookie) : undefined
  );
}

function unauthorized(message: string) {
  return Response.json(
    { error: { code: "UNAUTHENTICATED", message } },
    { status: 401 }
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorized("Sign in with Identity before viewing risk signals.");
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Customer ID too long." } },
      { status: 400 }
    );
  }

  try {
    const signals = await getRiskSignals(custId);
    return Response.json(signals);
  } catch (error) {
    console.error("Failed to fetch risk signals:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch risk signals.",
        },
      },
      { status: 500 }
    );
  }
}
