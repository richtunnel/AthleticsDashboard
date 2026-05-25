-- AlterTable
ALTER TABLE "CalendarSyncRequest" ADD COLUMN "workbookId" TEXT;

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_workbookId_idx" ON "CalendarSyncRequest"("workbookId");

-- AddForeignKey
ALTER TABLE "CalendarSyncRequest" ADD CONSTRAINT "CalendarSyncRequest_workbookId_fkey"
  FOREIGN KEY ("workbookId") REFERENCES "GamesWorkbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
