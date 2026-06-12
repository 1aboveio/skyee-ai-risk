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

function loginRedirect(request: NextRequest, reason: string): NextResponse {
  const url = new URL("/auth/login", request.url);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return loginRedirect(request, error);
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const cookieState = request.cookies.get(GRAPH_AUTH_STATE_COOKIE)?.value;
  const parsedState = parseAuthState(state);
  if (!code || !cookieState || state !== cookieState || !parsedState) {
    return loginRedirect(request, "invalid_state");
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
    return loginRedirect(request, "token_exchange_failed");
  }

  const payload = (await tokenResponse.json()) as IdentityTokenResponse;
  if (payload.organization.slug !== getRequiredOrgSlug()) {
    return loginRedirect(request, "invalid_org");
  }
  if (!payload.user.email?.toLowerCase().endsWith(`@${getRequiredEmailDomain()}`)) {
    return loginRedirect(request, "invalid_email_domain");
  }

  const sessionValue = createSessionValue(payload);
  if (!sessionValue) {
    return loginRedirect(request, "invalid_user");
  }

  const response = NextResponse.redirect(new URL(parsedState.returnTo, request.url));
  response.cookies.set(GRAPH_SESSION_COOKIE, sessionValue, sessionCookieOptions);
  response.cookies.delete(GRAPH_AUTH_STATE_COOKIE);
  return response;
}
