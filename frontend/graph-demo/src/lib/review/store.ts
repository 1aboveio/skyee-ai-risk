import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { isLocale, type Locale } from "@/lib/i18n/resolve-locale";

export type LocalePreferenceDb = {
  reviewerLocalePreference: {
    findUnique(args: {
      where: { reviewerId: string };
    }): Promise<{ locale: string } | null>;
  };
};

export async function getReviewerLocalePreference(
  reviewerId: string,
  db: LocalePreferenceDb = prisma
): Promise<Locale | null> {
  try {
    const preference = await db.reviewerLocalePreference.findUnique({
      where: { reviewerId },
    });
    if (preference && isLocale(preference.locale)) {
      return preference.locale;
    }
    return null;
  } catch (error) {
    // The preference table may not exist in unmigrated local/dev databases
    // before the first deployment. Treat that as "no preference".
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return null;
    }

    // Any other query error is unexpected: log it and let callers distinguish
    // it from a missing preference.
    console.error("Failed to load reviewer locale preference", {
      reviewerId,
      error,
    });
    throw error;
  }
}

export async function getOrCreateReviewSession(
  custId: string,
  contextType: string,
  reviewerId: string,
  reviewerEmail: string
) {
  // Try to find an active session first
  const existing = await prisma.reviewSession.findFirst({
    where: { custId, reviewerId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  // Create new session; if a concurrent insert won the race,
  // the @@unique([custId, reviewerId, status]) constraint throws
  // and we fall back to fetching the winner.
  try {
    return await prisma.reviewSession.create({
      data: { custId, contextType, reviewerId, reviewerEmail },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      const raced = await prisma.reviewSession.findFirst({
        where: { custId, reviewerId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function saveSnapshot(
  sessionId: string,
  snapshotType: string,
  note: string | null,
  evidenceData: Record<string, unknown>,
  fxRatesUsed?: Record<string, unknown>
) {
  return prisma.reviewSnapshot.create({
    data: {
      sessionId,
      snapshotType,
      note,
      evidenceData: evidenceData as Prisma.InputJsonValue,
      fxRatesUsed: fxRatesUsed
        ? (fxRatesUsed as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

export async function getReviewHistory(custId: string) {
  const sessions = await prisma.reviewSession.findMany({
    where: { custId },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
      },
      decisions: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sessions;
}

export async function saveDecision(
  sessionId: string,
  decisionType: string,
  note: string,
  snapshotId?: string
) {
  return prisma.reviewDecision.create({
    data: {
      sessionId,
      decisionType,
      note,
      snapshotId: snapshotId ?? null,
    },
  });
}

export async function getCustomerDecisions(custId: string) {
  const sessions = await prisma.reviewSession.findMany({
    where: { custId },
    include: {
      decisions: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return sessions.flatMap((s) =>
    s.decisions.map((d) => ({
      ...d,
      sessionId: s.id,
      contextType: s.contextType,
      reviewerEmail: s.reviewerEmail,
    }))
  );
}

export async function getSessionSnapshots(sessionId: string) {
  return prisma.reviewSnapshot.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}
