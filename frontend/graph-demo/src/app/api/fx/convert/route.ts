import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
} from "@/lib/auth/identity-session";
import { ForexRateService } from "@/lib/fx/forex-rate-service";
import { z } from "zod/v4";

const convertParamsSchema = z.object({
  amount: z
    .string()
    .transform((v) => parseFloat(v))
    .pipe(z.number().positive("Amount must be positive")),
  currency: z
    .string()
    .min(3, "Currency code must be 3 characters")
    .max(3, "Currency code must be 3 characters")
    .transform((v) => v.toUpperCase()),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .transform((v) => new Date(v + "T00:00:00Z")),
});

const forexService = new ForexRateService();

function getSessionFromRequest(request: Request) {
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

export async function GET(request: Request): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return Response.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in with Identity before converting FX.",
        },
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const parsed = convertParamsSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid FX conversion parameters.",
          detail: parsed.error.message,
        },
      },
      { status: 400 }
    );
  }

  const { amount, currency, date } = parsed.data;

  try {
    const result = await forexService.convertToUsd(amount, currency, date);

    return Response.json({
      usd_amount: result.usdAmount,
      rate: result.rate,
      rate_date: result.rateDate.toISOString().slice(0, 10),
      source: result.source,
      warning: result.warning,
    });
  } catch (error) {
    console.error("FX conversion failed:", error);
    return Response.json(
      {
        error: {
          code: "FX_SERVICE_ERROR",
          message: "Failed to convert amount.",
        },
      },
      { status: 500 }
    );
  }
}
