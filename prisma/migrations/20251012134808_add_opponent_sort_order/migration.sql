-- AlterTable
ALTER TABLE "Opponent" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Opponent_organizationId_sort_order_idx" ON "Opponent"("organizationId", "sort_order");
