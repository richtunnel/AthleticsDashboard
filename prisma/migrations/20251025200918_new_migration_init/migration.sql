/*
  Warnings:

  - You are about to drop the column `customerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `planPriceId` on the `Subscription` table. All the data in the column will be lost.
  - The `planType` column on the `Subscription` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `cancellationDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `dailyLoginCount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `deletionScheduledAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `googleCalendarEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoginDate` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `subscriptionStatus` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Subscription` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_subscriptionId_fkey";

-- DropIndex
DROP INDEX "public"."User_subscriptionId_key";

-- AlterTable
ALTER TABLE "EmailLog" ALTER COLUMN "sentById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "customerId",
DROP COLUMN "planPriceId",
ADD COLUMN     "priceId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "SubscriptionStatus" NOT NULL,
DROP COLUMN "planType",
ADD COLUMN     "planType" "PlanType";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "cancellationDate",
DROP COLUMN "city",
DROP COLUMN "dailyLoginCount",
DROP COLUMN "deletionScheduledAt",
DROP COLUMN "googleCalendarEmail",
DROP COLUMN "lastLoginAt",
DROP COLUMN "lastLoginDate",
DROP COLUMN "subscriptionId",
DROP COLUMN "subscriptionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
