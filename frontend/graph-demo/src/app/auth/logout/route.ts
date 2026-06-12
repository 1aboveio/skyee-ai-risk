import { NextResponse, type NextRequest } from "next/server";

import {
  GRAPH_AUTH_STATE_COOKIE,
  GRAPH_SESSION_COOKIE,
} from "@/lib/auth/identity-session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  response.cookies.delete(GRAPH_SESSION_COOKIE);
  response.cookies.delete(GRAPH_AUTH_STATE_COOKIE);
  return response;
}
