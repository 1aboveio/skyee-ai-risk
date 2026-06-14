import { AlertTriangleIcon, ArrowRightIcon, ShieldOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getIdentityLogoutUrl } from "@/lib/auth/identity-session";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const errorMessages: Record<string, { title: string; body: string }> = {
  access_denied: {
    title: "Access denied",
    body: "Your identity is valid, but your account is not authorized for this Skyee AI Risk workspace.",
  },
  invalid_client: {
    title: "Application is not configured",
    body: "The identity provider does not recognize this application client.",
  },
  invalid_state: {
    title: "Login session expired",
    body: "The sign-in request could not be verified. Start a new login flow.",
  },
  token_exchange_failed: {
    title: "Login could not be completed",
    body: "The application could not exchange the identity authorization code.",
  },
  invalid_org: {
    title: "Wrong organization",
    body: "The signed-in account belongs to a different organization.",
  },
  invalid_email_domain: {
    title: "Email domain not allowed",
    body: "Use an account from the configured Skyee email domain.",
  },
  invalid_user: {
    title: "User profile incomplete",
    body: "The identity provider returned a user profile without the required account fields.",
  },
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const error = firstParam(params.error) ?? "unknown_error";
  const description = firstParam(params.error_description);
  const message = errorMessages[error] ?? {
    title: "Login failed",
    body: "The identity provider returned an authentication error.",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm shadow-primary/5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldOffIcon className="size-5" />
          </div>
          <div>
            <Badge variant="outline">Authentication</Badge>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {message.title}
            </h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{message.body}</p>

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
            Login with another account
            <ArrowRightIcon className="size-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
