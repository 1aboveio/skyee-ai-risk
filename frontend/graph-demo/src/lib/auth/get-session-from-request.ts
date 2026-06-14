import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
  type GraphIdentitySession,
} from "@/lib/auth/identity-session";

/**
 * Extract the Graph Identity session from a request's cookie header.
 * Returns null when the cookie is missing or the session is invalid/expired.
 */
export function getSessionFromRequest(
  request: Request
): GraphIdentitySession | null {
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

/**
 * Build a 401 JSON response for unauthenticated requests.
 */
export function unauthorizedResponse(message: string) {
  return Response.json(
    { error: { code: "UNAUTHENTICATED", message } },
    { status: 401 }
  );
}
