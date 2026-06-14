import {
  getSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/get-session-from-request";
import { getTransactionSummary } from "@/lib/evidence/transactions";

const MAX_CUST_ID_LENGTH = 64;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in with Identity before viewing transaction summary."
    );
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Customer ID too long." } },
      { status: 400 }
    );
  }

  try {
    const summary = await getTransactionSummary(custId);
    return Response.json(summary);
  } catch (error) {
    console.error("Failed to fetch transaction summary:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch transaction summary.",
        },
      },
      { status: 500 }
    );
  }
}
