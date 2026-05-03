/*
  Warnings:

  - You are about to drop the column `idempotencyKey` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `payload` to the `StripeWebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('EMAIL', 'STRIPE_WEBHOOK', 'CALENDAR_SYNC', 'GAME_IMPORT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- DropIndex
DROP INDEX "EmailRecipient_status_lastAttempt_idx";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "idempotencyKey";

-- AlterTable
ALTER TABLE "StripeWebhookEvent" ADD COLUMN     "error" TEXT,
ADD COLUMN     "payload" JSONB NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "processedAt" DROP NOT NULL,
ALTER COLUMN "processedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_status_nextAttemptAt_idx" ON "BackgroundJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_organizationId_idx" ON "BackgroundJob"("organizationId");

-- CreateIndex
CREATE INDEX "BackgroundJob_userId_idx" ON "BackgroundJob"("userId");
