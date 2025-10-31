-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN "gameIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "groupId" TEXT,
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "recipientCategory" TEXT,
ADD COLUMN "additionalMessage" TEXT;

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
