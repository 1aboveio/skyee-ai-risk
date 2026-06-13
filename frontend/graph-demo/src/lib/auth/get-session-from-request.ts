import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
  type GraphIdentitySession,
} from "./identity-session";

/**
 * Extract the signed session from the request's cookie header.
 * Returns null when the cookie is missing, expired, or tampered with.
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
 * Build a standard 401 JSON response.
 */
export function unauthorizedResponse(message: string): Response {
  return Response.json(
    { error: { code: "UNAUTHENTICATED", message } },
    { status: 401 }
  );
}
