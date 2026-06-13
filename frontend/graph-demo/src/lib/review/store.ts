import prisma from "@/lib/prisma";

export async function getOrCreateReviewSession(
  custId: string,
  contextType: string,
  reviewerId: string,
  reviewerEmail: string
) {
  // Find active session for this customer and reviewer
  const existingSession = await prisma.reviewSession.findFirst({
    where: {
      custId,
      reviewerId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingSession) {
    return existingSession;
  }

  // Create new session
  return prisma.reviewSession.create({
    data: {
      custId,
      contextType,
      reviewerId,
      reviewerEmail,
    },
  });
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
      evidenceData,
      fxRatesUsed: fxRatesUsed ?? undefined,
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

export async function getSessionSnapshots(sessionId: string) {
  return prisma.reviewSnapshot.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}
