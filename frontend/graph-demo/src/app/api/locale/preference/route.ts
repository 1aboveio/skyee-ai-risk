import {
  getSessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/get-session-from-request";
import { isLocale } from "@/lib/i18n/resolve-locale";
import {
  getReviewerLocalePreference,
  updateReviewerLocalePreference,
} from "@/lib/review/store";

export async function GET(request: Request): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in before reading your locale preference."
    );
  }

  try {
    const locale = await getReviewerLocalePreference(session.user.id);
    return Response.json({ locale });
  } catch (error) {
    console.error("Failed to read locale preference:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to read locale preference.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedResponse(
      "Sign in before updating your locale preference."
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid JSON body.",
        },
      },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("locale" in body) ||
    !isLocale((body as Record<string, unknown>).locale)
  ) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Locale must be one of: en, zh-CN.",
        },
      },
      { status: 400 }
    );
  }

  const locale = (body as Record<string, unknown>).locale as
    | "en"
    | "zh-CN";

  try {
    const savedLocale = await updateReviewerLocalePreference(
      session.user.id,
      locale
    );
    return Response.json({ locale: savedLocale });
  } catch (error) {
    console.error("Failed to update locale preference:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update locale preference.",
        },
      },
      { status: 500 }
    );
  }
}
