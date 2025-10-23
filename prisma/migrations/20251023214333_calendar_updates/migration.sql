/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name]` on the table `EmailGroup` will be added. If there are existing duplicate values, this will fail.
  - Made the column `organizationId` on table `EmailGroup` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "EmailGroup" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "EmailGroup_userId_idx" ON "EmailGroup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailGroup_organizationId_name_key" ON "EmailGroup"("organizationId", "name");
