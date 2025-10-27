/*
  Warnings:

  - You are about to drop the column `createdAt` on the `UserLoginEvent` table. All the data in the column will be lost.
  - You are about to drop the column `ip` on the `UserLoginEvent` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `UserLoginEvent` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `UserLoginEvent` table. All the data in the column will be lost.
  - You are about to drop the `AccountDeletionReminder` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."AccountDeletionReminder" DROP CONSTRAINT "AccountDeletionReminder_userId_fkey";

-- DropIndex
DROP INDEX "public"."UserLoginEvent_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3),
ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3),
ADD COLUMN     "planType" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserLoginEvent" DROP COLUMN "createdAt",
DROP COLUMN "ip",
DROP COLUMN "provider",
DROP COLUMN "userAgent",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "public"."AccountDeletionReminder";

-- CreateTable
CREATE TABLE "RecoveryEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RecoveryEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryEmail_email_key" ON "RecoveryEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryEmail_userId_key" ON "RecoveryEmail"("userId");

-- CreateIndex
CREATE INDEX "UserLoginEvent_userId_idx" ON "UserLoginEvent"("userId");

-- CreateIndex
CREATE INDEX "UserLoginEvent_timestamp_idx" ON "UserLoginEvent"("timestamp");

-- AddForeignKey
ALTER TABLE "RecoveryEmail" ADD CONSTRAINT "RecoveryEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
