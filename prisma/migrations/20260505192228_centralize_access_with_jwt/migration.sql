/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name,workbookId]` on the table `CustomColumn` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'EMAIL_IMPORT';

-- DropIndex
DROP INDEX "CustomColumn_organizationId_name_key";

-- AlterTable
ALTER TABLE "CustomColumn" ADD COLUMN     "workbookId" TEXT;

-- CreateIndex
CREATE INDEX "CustomColumn_workbookId_idx" ON "CustomColumn"("workbookId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomColumn_organizationId_name_workbookId_key" ON "CustomColumn"("organizationId", "name", "workbookId");

-- AddForeignKey
ALTER TABLE "CustomColumn" ADD CONSTRAINT "CustomColumn_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "GamesWorkbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
