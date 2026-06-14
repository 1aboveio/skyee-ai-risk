import { NextResponse, type NextRequest } from "next/server";

import {
  GRAPH_AUTH_STATE_COOKIE,
  GRAPH_SESSION_COOKIE,
  buildGraphRedirectUri,
  createSessionValue,
  getIdentityBaseUrl,
  getIdentityClientSlug,
  getRequiredEmailDomain,
  getRequiredOrgSlug,
  parseAuthState,
  sessionCookieOptions,
  type IdentityTokenResponse,
} from "@/lib/auth/identity-session";

function errorRedirect(
  request: NextRequest,
  reason: string,
  description?: string | null
): NextResponse {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("error", reason);
  if (description) {
    url.searchParams.set("error_description", description);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(GRAPH_AUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return errorRedirect(
      request,
      error,
      request.nextUrl.searchParams.get("error_description")
    );
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookieState = request.cookies.get(GRAPH_AUTH_STATE_COOKIE)?.value;
  const parsedState = parseAuthState(state);
  if (!code || !cookieState || state !== cookieState || !parsedState) {
    return errorRedirect(request, "invalid_state");
  }

  const tokenResponse = await fetch(new URL("/api/apps/token", getIdentityBaseUrl()), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      code,
      client: getIdentityClientSlug(),
      redirect_uri: buildGraphRedirectUri(request.url),
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return errorRedirect(request, "token_exchange_failed");
  }

  const payload = (await tokenResponse.json()) as IdentityTokenResponse;
  if (payload.organization.slug !== getRequiredOrgSlug()) {
    return errorRedirect(request, "invalid_org");
  }
  if (!payload.user.email?.toLowerCase().endsWith(`@${getRequiredEmailDomain()}`)) {
    return errorRedirect(request, "invalid_email_domain");
  }

  const sessionValue = createSessionValue(payload);
  if (!sessionValue) {
    return errorRedirect(request, "invalid_user");
  }

  const response = NextResponse.redirect(new URL(parsedState.returnTo, request.url));
  response.cookies.set(GRAPH_SESSION_COOKIE, sessionValue, sessionCookieOptions);
  response.cookies.delete(GRAPH_AUTH_STATE_COOKIE);
  return response;
}
