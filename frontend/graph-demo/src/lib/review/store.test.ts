import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  getReviewerLocalePreference,
  updateReviewerLocalePreference,
  type LocalePreferenceDb,
  type LocalePreferenceWriteDb,
} from "./store";

// @covers lib/review/store
// @level unit

function makeFakeDb(returnValue: unknown): LocalePreferenceDb {
  return {
    reviewerLocalePreference: {
      findUnique: vi.fn().mockResolvedValue(returnValue),
    },
  } as unknown as LocalePreferenceDb;
}

function makeThrowingDb(error: Error): LocalePreferenceDb {
  return {
    reviewerLocalePreference: {
      findUnique: vi.fn().mockRejectedValue(error),
    },
  } as unknown as LocalePreferenceDb;
}

function makeUpsertDb(returnValue: { reviewerId: string; locale: string }): LocalePreferenceWriteDb {
  return {
    reviewerLocalePreference: {
      upsert: vi.fn().mockResolvedValue(returnValue),
    },
  } as unknown as LocalePreferenceWriteDb;
}

function makeUpsertThrowingDb(error: Error): LocalePreferenceWriteDb {
  return {
    reviewerLocalePreference: {
      upsert: vi.fn().mockRejectedValue(error),
    },
  } as unknown as LocalePreferenceWriteDb;
}

describe("getReviewerLocalePreference", () => {
  it("returns the stored locale when it is a supported value", async () => {
    const db = makeFakeDb({ reviewerId: "r1", locale: "en", updatedAt: new Date() });
    await expect(getReviewerLocalePreference("r1", db)).resolves.toBe("en");
    expect(db.reviewerLocalePreference.findUnique).toHaveBeenCalledWith({
      where: { reviewerId: "r1" },
    });
  });

  it("returns null when no preference record exists", async () => {
    const db = makeFakeDb(null);
    await expect(getReviewerLocalePreference("r1", db)).resolves.toBeNull();
  });

  it("returns null when the stored locale is not supported", async () => {
    const db = makeFakeDb({ reviewerId: "r1", locale: "fr", updatedAt: new Date() });
    await expect(getReviewerLocalePreference("r1", db)).resolves.toBeNull();
  });

  it("returns null when the preference table does not exist (P2021)", async () => {
    const tableMissingError = new Prisma.PrismaClientKnownRequestError(
      "The table `ReviewerLocalePreference` does not exist in the current database.",
      { code: "P2021", clientVersion: "7.8.0" }
    );
    const db = makeThrowingDb(tableMissingError);

    await expect(getReviewerLocalePreference("r1", db)).resolves.toBeNull();
  });

  it("logs and re-throws other Prisma errors so callers can distinguish them", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const otherError = new Prisma.PrismaClientKnownRequestError(
      "Database connection failed",
      { code: "P1001", clientVersion: "7.8.0" }
    );
    const db = makeThrowingDb(otherError);

    await expect(getReviewerLocalePreference("r1", db)).rejects.toThrow(
      otherError
    );
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0]?.[0]).toMatch(
      /Failed to load reviewer locale preference/i
    );

    consoleSpy.mockRestore();
  });

  it("logs and re-throws non-Prisma errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const genericError = new Error("unexpected");
    const db = makeThrowingDb(genericError);

    await expect(getReviewerLocalePreference("r1", db)).rejects.toThrow(
      genericError
    );
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });
});

describe("updateReviewerLocalePreference", () => {
  it("upserts a preference record for the reviewer", async () => {
    const db = makeUpsertDb({ reviewerId: "r1", locale: "en" });

    await expect(updateReviewerLocalePreference("r1", "en", db)).resolves.toBe("en");
    expect(db.reviewerLocalePreference.upsert).toHaveBeenCalledWith({
      where: { reviewerId: "r1" },
      create: { reviewerId: "r1", locale: "en" },
      update: { locale: "en" },
    });
  });

  it("upserts zh-CN locale preference", async () => {
    const db = makeUpsertDb({ reviewerId: "r1", locale: "zh-CN" });

    await expect(updateReviewerLocalePreference("r1", "zh-CN", db)).resolves.toBe("zh-CN");
  });

  it("logs and re-throws Prisma errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const dbError = new Prisma.PrismaClientKnownRequestError(
      "Database connection failed",
      { code: "P1001", clientVersion: "7.8.0" }
    );
    const db = makeUpsertThrowingDb(dbError);

    await expect(updateReviewerLocalePreference("r1", "en", db)).rejects.toThrow(
      dbError
    );
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0]?.[0]).toMatch(
      /Failed to update reviewer locale preference/i
    );

    consoleSpy.mockRestore();
  });

  it("logs and re-throws non-Prisma errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const genericError = new Error("unexpected");
    const db = makeUpsertThrowingDb(genericError);

    await expect(updateReviewerLocalePreference("r1", "en", db)).rejects.toThrow(
      genericError
    );
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });
});
