import {
  GRAPH_SESSION_COOKIE,
  parseSessionValue,
} from "@/lib/auth/identity-session";
import { getCachedRates } from "@/lib/fx/store";
import { z } from "zod/v4";

const ratesParamsSchema = z.object({
  currency: z
    .string()
    .min(3, "Currency code must be 3 characters")
    .max(3, "Currency code must be 3 characters")
    .transform((v) => v.toUpperCase()),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD format")
    .transform((v) => new Date(v + "T00:00:00Z")),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD format")
    .transform((v) => new Date(v + "T00:00:00Z")),
});

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
          message: "Sign in with Identity before viewing FX rates.",
        },
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const parsed = ratesParamsSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid FX rates parameters.",
          detail: parsed.error.message,
        },
      },
      { status: 400 }
    );
  }

  const { currency, start, end } = parsed.data;

  try {
    const rates = await getCachedRates(currency, start, end);

    return Response.json(
      rates.map((r) => ({
        currency: r.quoteCurrency,
        rate: r.rate.toString(),
        rate_date: r.rateDate.toISOString().slice(0, 10),
        source: r.source,
      }))
    );
  } catch (error) {
    console.error("Failed to fetch FX rates:", error);
    return Response.json(
      {
        error: {
          code: "FX_SERVICE_ERROR",
          message: "Failed to fetch FX rates.",
        },
      },
      { status: 500 }
    );
  }
}
