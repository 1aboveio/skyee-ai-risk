/**
 * Database seed helper for E2E tests.
 *
 * Seeds the graph_demo database with deterministic test data
 * for the Customer Risk Review Workbench tests.
 *
 * Run with: DATABASE_URL=... npx tsx e2e/helpers/seed.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://graph_demo:graph_demo@localhost:5432/graph_demo";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const TEST_CUST_ID = "E2E_CUST_001";
const TEST_REVIEWER_ID = "test-user-001";
const TEST_REVIEWER_EMAIL = "e2e-tester@skyee360.com";

async function seed() {
  console.log("[seed] Cleaning up previous test data...");
  await prisma.reviewDecision.deleteMany({
    where: { session: { custId: TEST_CUST_ID } },
  });
  await prisma.reviewSnapshot.deleteMany({
    where: { session: { custId: TEST_CUST_ID } },
  });
  await prisma.reviewSession.deleteMany({
    where: { custId: TEST_CUST_ID },
  });

  console.log("[seed] Creating review session...");
  const session = await prisma.reviewSession.create({
    data: {
      custId: TEST_CUST_ID,
      contextType: "WORKFLOW_HUMAN_REVIEW",
      reviewerId: TEST_REVIEWER_ID,
      reviewerEmail: TEST_REVIEWER_EMAIL,
      status: "ACTIVE",
    },
  });

  console.log("[seed] Creating initial snapshot...");
  await prisma.reviewSnapshot.create({
    data: {
      sessionId: session.id,
      snapshotType: "SNAPSHOT_ONLY",
      note: "Initial evidence capture for E2E testing",
      evidenceData: {
        custId: TEST_CUST_ID,
        fetchedAt: new Date().toISOString(),
        panels: {},
      },
    },
  });

  console.log("[seed] Done. Session ID:", session.id);
  console.log("[seed] Test customer:", TEST_CUST_ID);
}

seed()
  .catch((e) => {
    console.error("[seed] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
