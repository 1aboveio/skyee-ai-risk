import type { getGraphIdentitySession } from "@/lib/auth/identity-session";
import { resolveLocale, type Locale } from "./resolve-locale";

export type ResolveInitialLocaleOptions = {
  /**
   * When true, locale is resolved from browser detection only and the
   * reviewer preference store is never consulted. Used for auth routes such
   * as `/auth/error` where a trusted signed-in identity may not exist.
   */
  isAuthRoute: boolean;
  session: Awaited<ReturnType<typeof getGraphIdentitySession>>;
  acceptLanguage: string | undefined;
  getReviewerLocalePreference: (reviewerId: string) => Promise<Locale | null>;
};

/**
 * Resolve the initial locale for a server-rendered page.
 *
 * Auth routes always use browser detection/fallback. Signed-in routes prefer
 * the stored reviewer locale, falling back to the browser language and then
 * the default locale.
 */
export async function resolveInitialLocale({
  isAuthRoute,
  session,
  acceptLanguage,
  getReviewerLocalePreference,
}: ResolveInitialLocaleOptions): Promise<Locale> {
  if (isAuthRoute) {
    return resolveLocale(undefined, acceptLanguage);
  }

  if (session) {
    const storedPreference = await getReviewerLocalePreference(
      session.user.id
    );
    return resolveLocale(storedPreference ?? undefined, acceptLanguage);
  }

  return resolveLocale(undefined, acceptLanguage);
}
