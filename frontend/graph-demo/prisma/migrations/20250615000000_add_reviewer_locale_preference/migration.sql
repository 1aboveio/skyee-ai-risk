-- CreateTable
CREATE TABLE "ReviewerLocalePreference" (
    "reviewerId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerLocalePreference_pkey" PRIMARY KEY ("reviewerId")
);
