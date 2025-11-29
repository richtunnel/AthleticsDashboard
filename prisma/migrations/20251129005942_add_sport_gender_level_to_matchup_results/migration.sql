-- AlterTable
ALTER TABLE "MatchupResult" ADD COLUMN "sport" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "level" TEXT;

-- CreateIndex
CREATE INDEX "MatchupResult_organizationId_sport_gender_level_idx" ON "MatchupResult"("organizationId", "sport", "gender", "level");
