import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
  type GraphIdentitySession,
} from "@/lib/auth/identity-session";
import { getCustomerProfile } from "@/lib/evidence/customer-profile";

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
    return unauthorized("Sign in with Identity before viewing customer profile.");
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Customer ID too long." } },
      { status: 400 }
    );
  }

  try {
    const profile = await getCustomerProfile(custId);

    if (!profile) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Customer not found." } },
        { status: 404 }
      );
    }

    return Response.json(profile);
  } catch (error) {
    console.error("Failed to fetch customer profile:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch customer profile.",
        },
      },
      { status: 500 }
    );
  }
}
