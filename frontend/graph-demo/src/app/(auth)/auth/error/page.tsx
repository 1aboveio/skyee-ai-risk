import { AlertTriangleIcon, ArrowRightIcon, ShieldOffIcon } from "lucide-react";

import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { getIdentityLogoutUrl } from "@/lib/auth/identity-session";
import { t, type Locale } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/keys";
import { resolveLocale } from "@/lib/i18n/resolve-locale";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ErrorMessageKeys = {
  title: DictionaryKey;
  body: DictionaryKey;
};

const errorMessages: Record<string, ErrorMessageKeys> = {
  access_denied: {
    title: "authAccessDeniedTitle",
    body: "authAccessDeniedBody",
  },
  invalid_client: {
    title: "authApplicationNotConfiguredTitle",
    body: "authApplicationNotConfiguredBody",
  },
  invalid_state: {
    title: "authLoginSessionExpiredTitle",
    body: "authLoginSessionExpiredBody",
  },
  token_exchange_failed: {
    title: "authTokenExchangeFailedTitle",
    body: "authTokenExchangeFailedBody",
  },
  invalid_org: {
    title: "authWrongOrganizationTitle",
    body: "authWrongOrganizationBody",
  },
  invalid_email_domain: {
    title: "authEmailDomainNotAllowedTitle",
    body: "authEmailDomainNotAllowedBody",
  },
  invalid_user: {
    title: "authUserProfileIncompleteTitle",
    body: "authUserProfileIncompleteBody",
  },
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function resolveAuthLocale(acceptLanguage: string | undefined): Locale {
  // Auth routes must never read or write a signed-in reviewer preference.
  return resolveLocale(undefined, acceptLanguage);
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = firstParam(params.error) ?? "unknown_error";
  const description = firstParam(params.error_description);
  const acceptLanguage = (await headers()).get("accept-language") ?? undefined;
  const locale = resolveAuthLocale(acceptLanguage);

  const messageKeys = errorMessages[error] ?? {
    title: "authLoginFailedTitle",
    body: "authLoginFailedBody",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm shadow-primary/5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldOffIcon className="size-5" />
          </div>
          <div>
            <Badge variant="outline">{t("authentication", locale)}</Badge>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {t(messageKeys.title, locale)}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {t(messageKeys.body, locale)}
        </p>

        {description ? (
          <div className="mt-4 flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="leading-6 text-muted-foreground">{description}</p>
          </div>
        ) : null}

        <form
          action={getIdentityLogoutUrl("http://localhost:3000/auth/login")}
          method="get"
          className="mt-6 flex flex-wrap gap-2"
        >
          <button
            type="submit"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("loginWithAnotherAccount", locale)}
            <ArrowRightIcon className="size-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
