-- AlterTable
ALTER TABLE "CollaborativeMember" ADD COLUMN     "emailError" TEXT,
ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailSentAt" TIMESTAMP(3);
