/**
 * Auth helper for E2E tests.
 *
 * Generates a valid HMAC-SHA256 signed session cookie that the app's
 * `getGraphIdentitySession()` will accept. Uses the same signing logic
 * as `src/lib/auth/identity-session.ts`.
 */
import { createHmac } from "node:crypto";

const SESSION_SECRET =
  process.env.APP_SESSION_SECRET ?? "test-session-secret-for-e2e-only-32b!";

export interface TestSession {
  user: {
    id: string;
    email: string;
    name: string;
    image: null;
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
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function signedValue(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

/**
 * Create a test session and return the signed cookie value.
 * The session passes all checks in parseSessionValue():
 *  - org slug matches IDENTITY_ORG_SLUG ("skyee")
 *  - email ends with @skyee360.com
 */
export function createTestSessionCookie(
  overrides: Partial<TestSession> = {}
): string {
  const session: TestSession = {
    user: {
      id: "test-user-001",
      email: "e2e-tester@skyee360.com",
      name: "E2E Test User",
      image: null,
    },
    organization: {
      id: "org-skyee-test",
      slug: "skyee",
      name: "Skyee Test Org",
    },
    membership: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours from now
    ...overrides,
  };

  return signedValue(session);
}

/**
 * The cookie name used by the app.
 */
export const SESSION_COOKIE_NAME = "skyee_graph_session";
