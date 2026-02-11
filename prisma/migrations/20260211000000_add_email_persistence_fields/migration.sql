-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS     "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "recipientCategory" TEXT;
