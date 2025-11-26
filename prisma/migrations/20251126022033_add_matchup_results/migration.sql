-- CreateTable
CREATE TABLE "MatchupResult" (
    "id" TEXT NOT NULL,
    "organizationScore" INTEGER NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "isWin" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "opponentId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "MatchupResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchupResult_organizationId_idx" ON "MatchupResult"("organizationId");

-- CreateIndex
CREATE INDEX "MatchupResult_opponentId_idx" ON "MatchupResult"("opponentId");

-- AddForeignKey
ALTER TABLE "MatchupResult" ADD CONSTRAINT "MatchupResult_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "Opponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
