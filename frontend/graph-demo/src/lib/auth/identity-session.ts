import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const GRAPH_SESSION_COOKIE = "skyee_graph_session";
export const GRAPH_AUTH_STATE_COOKIE = "skyee_graph_auth_state";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const STATE_MAX_AGE_SECONDS = 60 * 10;

export type GraphIdentitySession = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  membership: {
    role: string;
    status: string;
  };
  exp: number;
};

export type GraphAuthState = {
  nonce: string;
  returnTo: string;
  exp: number;
};

export type IdentityTokenResponse = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
  };
  organization: {
    id: string;
    slug: string;
    name: string;
  };
  membership: {
    role: string;
    status: string;
  };
};

function getSessionSecret(): string {
  const secret = process.env.APP_SESSION_SECRET ?? process.env.IDENTITY_SESSION_SECRET;
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SESSION_SECRET is required in production.");
  }
  return "skyee-graph-demo-dev-session-secret";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function signedValue(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

function parseSignedValue<T extends { exp: number }>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as T;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  return (value ?? fallback).replace(/\/+$/, "");
}

export function getIdentityBaseUrl(): string {
  return normalizeBaseUrl(process.env.IDENTITY_BASE_URL, "http://localhost:3000");
}

export function getAppBaseUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return normalizeBaseUrl(process.env.APP_BASE_URL, origin);
}

export function getIdentityClientSlug(): string {
  return process.env.IDENTITY_APP_CLIENT_SLUG ?? "skyee-ai-risk";
}

export function getRequiredOrgSlug(): string {
  return process.env.IDENTITY_ORG_SLUG ?? "skyee";
}

export function getRequiredEmailDomain(): string {
  return (process.env.IDENTITY_ALLOWED_EMAIL_DOMAIN ?? "skyee360.com")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

export function buildGraphRedirectUri(requestUrl: string): string {
  return `${getAppBaseUrl(requestUrl)}/auth/callback`;
}

export function getIdentityLogoutUrl(redirectTo?: string): string {
  const url = new URL("/logout", getIdentityBaseUrl());
  url.searchParams.set("client_id", getIdentityClientSlug());
  if (redirectTo) {
    url.searchParams.set("redirectTo", redirectTo);
  }
  return url.toString();
}

export function createAuthState(returnTo: string): { state: GraphAuthState; value: string } {
  const state: GraphAuthState = {
    nonce: randomBytes(16).toString("base64url"),
    returnTo,
    exp: Date.now() + STATE_MAX_AGE_SECONDS * 1000,
  };
  return { state, value: signedValue(state) };
}

export function parseAuthState(value: string | undefined): GraphAuthState | null {
  return parseSignedValue<GraphAuthState>(value);
}

export function createSessionValue(payload: IdentityTokenResponse): string | null {
  const email = payload.user.email?.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const session: GraphIdentitySession = {
    user: {
      id: payload.user.id,
      email,
      name: payload.user.name,
      image: payload.user.image,
    },
    organization: payload.organization,
    membership: payload.membership,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  return signedValue(session);
}

export function parseSessionValue(value: string | undefined): GraphIdentitySession | null {
  const session = parseSignedValue<GraphIdentitySession>(value);
  if (!session) {
    return null;
  }
  if (session.organization.slug !== getRequiredOrgSlug()) {
    return null;
  }
  if (!session.user.email.toLowerCase().endsWith(`@${getRequiredEmailDomain()}`)) {
    return null;
  }
  return session;
}

export async function getGraphIdentitySession(): Promise<GraphIdentitySession | null> {
  const cookieStore = await cookies();
  return parseSessionValue(cookieStore.get(GRAPH_SESSION_COOKIE)?.value);
}

export function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  if (value.startsWith("/auth/")) {
    return "/";
  }
  return value;
}

export const sessionCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export const stateCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: STATE_MAX_AGE_SECONDS,
};
