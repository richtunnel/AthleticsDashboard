-- CreateTable
CREATE TABLE "GameExpense" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "travelExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foodExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clothesExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "giftsExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameExpense_gameId_key" ON "GameExpense"("gameId");

-- CreateIndex
CREATE INDEX "GameExpense_gameId_idx" ON "GameExpense"("gameId");

-- AddForeignKey
ALTER TABLE "GameExpense" ADD CONSTRAINT "GameExpense_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
