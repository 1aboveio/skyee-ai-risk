import { GRAPH_SESSION_COOKIE, parseSessionValue } from "@/lib/auth/identity-session";
import { getOrCreateReviewSession, saveSnapshot } from "@/lib/review/store";
import { z } from "zod/v4";

const snapshotRequestSchema = z.object({
  note: z.string().optional(),
  evidenceData: z.record(z.string(), z.unknown()),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  // Auth check
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GRAPH_SESSION_COOKIE}=`))
    ?.slice(GRAPH_SESSION_COOKIE.length + 1);
  const session = parseSessionValue(
    sessionCookie ? decodeURIComponent(sessionCookie) : undefined
  );
  if (!session) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in with Identity before saving snapshots.",
        },
      },
      { status: 401 }
    );
  }

  const { custId } = await params;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
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
    // Get or create review session
    const reviewSession = await getOrCreateReviewSession(
      custId,
      "AD_HOC",
      session.user.id,
      session.user.email
    );

    // Save snapshot
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
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save snapshot.",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  // Auth check
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${GRAPH_SESSION_COOKIE}=`))
    ?.slice(GRAPH_SESSION_COOKIE.length + 1);
  const session = parseSessionValue(
    sessionCookie ? decodeURIComponent(sessionCookie) : undefined
  );
  if (!session) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in with Identity before viewing snapshots.",
        },
      },
      { status: 401 }
    );
  }

  const { custId } = await params;

  try {
    // Get all sessions for this customer to find snapshots
    const history = await import("@/lib/review/store").then((m) =>
      m.getReviewHistory(custId)
    );

    // Flatten all snapshots from all sessions
    const snapshots = history.flatMap((session) =>
      session.snapshots.map((snapshot) => ({
        ...snapshot,
        sessionId: session.id,
        contextType: session.contextType,
        reviewerEmail: session.reviewerEmail,
      }))
    );

    // Sort by createdAt descending
    snapshots.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return Response.json(snapshots);
  } catch (error) {
    console.error("Failed to fetch snapshots:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch snapshots.",
        },
      },
      { status: 500 }
    );
  }
}
