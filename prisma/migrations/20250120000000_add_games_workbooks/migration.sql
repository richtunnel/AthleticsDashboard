-- Create GamesWorkbook table
CREATE TABLE "GamesWorkbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamesWorkbook_pkey" PRIMARY KEY ("id")
);

-- Add workbookId column to Game table
ALTER TABLE "Game" ADD COLUMN "workbookId" TEXT;

-- Create indexes
CREATE INDEX "GamesWorkbook_userId_idx" ON "GamesWorkbook"("userId");
CREATE UNIQUE INDEX "GamesWorkbook_userId_sortOrder_key" ON "GamesWorkbook"("userId", "sortOrder");
CREATE INDEX "Game_workbookId_idx" ON "Game"("workbookId");

-- Add foreign key constraints
ALTER TABLE "GamesWorkbook" ADD CONSTRAINT "GamesWorkbook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Game" ADD CONSTRAINT "Game_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "GamesWorkbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
