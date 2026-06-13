import {
  getSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/get-session-from-request";
import { getTransactionList } from "@/lib/evidence/transactions";
import { z } from "zod/v4";

const MAX_CUST_ID_LENGTH = 64;

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  minUsdAmount: z.coerce.number().min(0).optional(),
  maxUsdAmount: z.coerce.number().min(0).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ custId: string }> }
): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in with Identity before viewing transactions."
    );
  }

  const { custId } = await params;

  if (custId.length > MAX_CUST_ID_LENGTH) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Customer ID too long." } },
      { status: 400 }
    );
  }

  // Parse query parameters
  const url = new URL(request.url);
  const queryResult = querySchema.safeParse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    direction: url.searchParams.get("direction") ?? undefined,
    minUsdAmount: url.searchParams.get("minUsdAmount") ?? undefined,
    maxUsdAmount: url.searchParams.get("maxUsdAmount") ?? undefined,
  });

  if (!queryResult.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters.",
          details: queryResult.error.issues,
        },
      },
      { status: 400 }
    );
  }

  const { cursor, limit, startDate, endDate, direction, minUsdAmount, maxUsdAmount } =
    queryResult.data;

  try {
    const result = await getTransactionList(custId, cursor, limit, {
      startDate,
      endDate,
      direction,
      minUsdAmount,
      maxUsdAmount,
    });
    return Response.json(result);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch transactions.",
        },
      },
      { status: 500 }
    );
  }
}
