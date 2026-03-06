/*
  Warnings:

  - A unique constraint covering the columns `[parentUserId]` on the table `ConnectedParent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calendarSynced` to the `ConnectedParent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentUserId` to the `ConnectedParent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConnectedParent" ADD COLUMN     "calendarSynced" BOOLEAN NOT NULL,
ADD COLUMN     "membershipStatus" "SubscriptionStatus",
ADD COLUMN     "parentUserId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedParent_parentUserId_key" ON "ConnectedParent"("parentUserId");
