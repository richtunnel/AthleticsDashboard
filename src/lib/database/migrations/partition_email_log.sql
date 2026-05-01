-- Migration: Partition EmailLog table by createdAt month
-- This migration converts the EmailLog table into a partitioned table for better performance at scale.

-- Step 1: Rename existing table
ALTER TABLE "EmailLog" RENAME TO "EmailLog_old";

-- Step 2: Create new partitioned table
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT[] NOT NULL,
    "cc" TEXT[] NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyTo" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupId" TEXT,
    "campaignId" TEXT,
    "recipientCategory" TEXT,
    "additionalMessage" TEXT,
    "gameId" TEXT,
    "sentById" TEXT,
    "selectedSchoolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibleColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Step 3: Create initial partitions
CREATE TABLE "EmailLog_2025_01" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE "EmailLog_2025_02" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE "EmailLog_2025_03" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE "EmailLog_2025_04" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE "EmailLog_2025_05" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE "EmailLog_2025_06" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE "EmailLog_2025_07" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE "EmailLog_2025_08" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE "EmailLog_2025_09" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE "EmailLog_2025_10" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE "EmailLog_2025_11" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE "EmailLog_2025_12" PARTITION OF "EmailLog" FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Default partition for anything outside the above ranges
CREATE TABLE "EmailLog_default" PARTITION OF "EmailLog" DEFAULT;

-- Step 4: Copy data from old table to new partitioned table
INSERT INTO "EmailLog" (
    "id", "to", "cc", "subject", "body", "replyTo", "status", "sentAt", "error", "createdAt",
    "gameIds", "groupId", "campaignId", "recipientCategory", "additionalMessage",
    "gameId", "sentById", "selectedSchoolNames", "visibleColumnIds", "customRecipients"
)
SELECT 
    "id", "to", "cc", "subject", "body", "replyTo", "status", "sentAt", "error", "createdAt",
    "gameIds", "groupId", "campaignId", "recipientCategory", "additionalMessage",
    "gameId", "sentById", "selectedSchoolNames", "visibleColumnIds", "customRecipients"
FROM "EmailLog_old";

-- Step 5: Re-create indexes (indexes on partitioned table automatically apply to partitions)
CREATE INDEX "EmailLog_gameId_idx" ON "EmailLog" ("gameId");
CREATE INDEX "EmailLog_sentById_idx" ON "EmailLog" ("sentById");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog" ("createdAt");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog" ("status");

-- Step 6: Drop the old table
DROP TABLE "EmailLog_old";
