-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Game_createdById_sortOrder_idx" ON "Game"("createdById", "sortOrder");
