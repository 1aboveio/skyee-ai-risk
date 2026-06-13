import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
  type GraphIdentitySession,
} from "@/lib/auth/identity-session";
import { getOrCreateReviewSession, getReviewHistory, saveSnapshot } from "@/lib/review/store";
import { z } from "zod/v4";

const MAX_NOTE_LENGTH = 2000;
const MAX_CUST_ID_LENGTH = 64;

const snapshotRequestSchema = z.object({
  note: z.string().max(MAX_NOTE_LENGTH).optional(),
  evidenceData: z.record(z.string(), z.unknown()),
});

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorized("Sign in with Identity before saving snapshots.");
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Customer ID too long." } },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const parsed = snapshotRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid snapshot request.",
          detail: parsed.error.message,
        },
      },
      { status: 400 }
    );
  }

  try {
    const reviewSession = await getOrCreateReviewSession(
      custId,
      "AD_HOC",
      session.user.id,
      session.user.email
    );

    const snapshot = await saveSnapshot(
      reviewSession.id,
      "SNAPSHOT_ONLY",
      parsed.data.note ?? null,
      parsed.data.evidenceData
    );

    return Response.json(snapshot, { status: 201 });
  } catch (error) {
    console.error("Failed to save snapshot:", error);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to save snapshot." } },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorized("Sign in with Identity before viewing snapshots.");
  }

  const { custId } = await params;

  try {
    const history = await getReviewHistory(custId);

    const snapshots = history.flatMap((s) =>
      s.snapshots.map((snapshot) => ({
        ...snapshot,
        sessionId: s.id,
        contextType: s.contextType,
        reviewerEmail: s.reviewerEmail,
      }))
    );

    snapshots.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return Response.json(snapshots);
  } catch (error) {
    console.error("Failed to fetch snapshots:", error);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch snapshots." } },
      { status: 500 }
    );
  }
}
