-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "customRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recipientCategory" TEXT;
