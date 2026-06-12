import { NextResponse, type NextRequest } from "next/server";

import {
  GRAPH_AUTH_STATE_COOKIE,
  buildGraphRedirectUri,
  createAuthState,
  getIdentityBaseUrl,
  getIdentityClientSlug,
  getRequiredOrgSlug,
  sanitizeReturnTo,
  stateCookieOptions,
} from "@/lib/auth/identity-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const { value: state } = createAuthState(returnTo);
  const identityUrl = new URL("/api/apps/authorize", getIdentityBaseUrl());
  identityUrl.searchParams.set("client", getIdentityClientSlug());
  identityUrl.searchParams.set("redirect_uri", buildGraphRedirectUri(request.url));
  identityUrl.searchParams.set("org", getRequiredOrgSlug());
  identityUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(identityUrl);
  response.cookies.set(GRAPH_AUTH_STATE_COOKIE, state, stateCookieOptions);
  return response;
}
