import {
  getSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/get-session-from-request";
import { getRiskSignals } from "@/lib/evidence/risk-signals";

const MAX_CUST_ID_LENGTH = 64;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in with Identity before viewing risk signals."
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
    const signals = await getRiskSignals(custId);
    return Response.json(signals);
  } catch (error) {
    console.error("Failed to fetch risk signals:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch risk signals.",
        },
      },
      { status: 500 }
    );
  }
}
