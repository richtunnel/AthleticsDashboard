/*
  Warnings:

  - You are about to drop the column `priceId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Subscription` table. All the data in the column will be lost.
  - The `planType` column on the `Subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[subscriptionId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Made the column `sentById` on table `EmailLog` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `customerId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropIndex
DROP INDEX "public"."Subscription_stripeSubscriptionId_idx";

-- DropIndex
DROP INDEX "public"."Subscription_userId_key";

-- AlterTable
ALTER TABLE "EmailLog" ALTER COLUMN "sentById" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "priceId",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "userId",
ADD COLUMN     "customerId" TEXT NOT NULL,
ADD COLUMN     "planPriceId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL,
DROP COLUMN "planType",
ADD COLUMN     "planType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cancellationDate" TIMESTAMP(3),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dailyLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3),
ADD COLUMN     "googleCalendarEmail" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_subscriptionId_key" ON "User"("subscriptionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
