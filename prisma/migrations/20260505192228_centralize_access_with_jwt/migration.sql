/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name,workbookId]` on the table `CustomColumn` will be added. If there are existing duplicate values, this will fail.

*/
-- NOTE: All statements are written idempotently because migration
-- 20260505172320_add_workbook_and_cost_column_constraints already applied the
-- identical DDL operations.  Using IF NOT EXISTS / IF EXISTS guards and the
-- DO $$ BEGIN … EXCEPTION … END $$; pattern (established in
-- 20260218174307_add_collaboartion_email_tracking) lets Prisma re-apply or
-- resolve this migration without errors regardless of current DB state.

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'EMAIL_IMPORT';

-- DropIndex
DROP INDEX IF EXISTS "CustomColumn_organizationId_name_key";

-- AlterTable
ALTER TABLE "CustomColumn" ADD COLUMN IF NOT EXISTS "workbookId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomColumn_workbookId_idx" ON "CustomColumn"("workbookId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CustomColumn_organizationId_name_workbookId_key" ON "CustomColumn"("organizationId", "name", "workbookId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CustomColumn" ADD CONSTRAINT "CustomColumn_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "GamesWorkbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
