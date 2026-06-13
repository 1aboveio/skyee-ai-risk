import {
  getSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/get-session-from-request";
import {
  getOrCreateReviewSession,
  saveSnapshot,
  saveDecision,
  getCustomerDecisions,
} from "@/lib/review/store";
import { z } from "zod/v4";

const MAX_NOTE_LENGTH = 2000;
const MAX_CUST_ID_LENGTH = 64;

const decisionRequestSchema = z.object({
  decisionType: z.enum(["ACCEPT", "REJECT"]),
  note: z.string().min(1, "Note is required").max(MAX_NOTE_LENGTH),
  evidenceData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in with Identity before submitting decisions."
    );
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Customer ID too long.",
        },
      },
      { status: 400 }
    );
  }

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

  const parsed = decisionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid decision request.",
          detail: parsed.error.message,
        },
      },
      { status: 400 }
    );
  }

  try {
    const reviewSession = await getOrCreateReviewSession(
      custId,
      "WORKFLOW_HUMAN_REVIEW",
      session.user.id,
      session.user.email
    );

    // Auto-save a snapshot at decision time
    const snapshot = await saveSnapshot(
      reviewSession.id,
      "DECISION",
      parsed.data.note,
      parsed.data.evidenceData ?? {}
    );

    // Create the decision linked to the snapshot
    const decision = await saveDecision(
      reviewSession.id,
      parsed.data.decisionType,
      parsed.data.note,
      snapshot.id
    );

    return Response.json(
      {
        ...decision,
        snapshotId: snapshot.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to save decision:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save decision.",
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
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in with Identity before viewing decisions."
    );
  }

  const { custId } = await params;

  try {
    const decisions = await getCustomerDecisions(custId);

    decisions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return Response.json(decisions);
  } catch (error) {
    console.error("Failed to fetch decisions:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch decisions.",
        },
      },
      { status: 500 }
    );
  }
}
