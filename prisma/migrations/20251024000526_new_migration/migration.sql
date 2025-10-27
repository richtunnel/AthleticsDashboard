/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,name]` on the table `EmailGroup` will be added. If there are existing duplicate values, this will fail.
  - Made the column `organizationId` on table `EmailGroup` required. This step will fail if there are existing NULL values in that column.

*/
-- Data migration: backfill existing email groups before enforcing constraints
UPDATE "EmailGroup" AS eg
SET "organizationId" = u."organizationId"
FROM "User" AS u
WHERE eg."userId" = u."id" AND eg."organizationId" IS NULL;

WITH duplicates AS (
    SELECT
        "id",
        "organizationId",
        "name",
        ROW_NUMBER() OVER (
            PARTITION BY "organizationId", "name"
            ORDER BY "createdAt", "id"
        ) AS row_number
    FROM "EmailGroup"
)
UPDATE "EmailGroup" AS eg
SET "name" = eg."name" || ' (duplicate ' || (duplicates.row_number - 1)::text || ')'
FROM duplicates
WHERE eg."id" = duplicates."id" AND duplicates.row_number > 1;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "EmailGroup" WHERE "organizationId" IS NULL) THEN
        RAISE EXCEPTION 'Cannot set EmailGroup.organizationId to NOT NULL because some rows still have a NULL value.';
    END IF;
END
$$;

-- AlterTable
ALTER TABLE "EmailGroup" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "actualArrivalTime" TIMESTAMP(3),
ADD COLUMN     "actualDepartureTime" TIMESTAMP(3),
ADD COLUMN     "autoFillBusInfo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "busTravel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recommendedArrivalTime" TIMESTAMP(3),
ADD COLUMN     "recommendedDepartureTime" TIMESTAMP(3),
ADD COLUMN     "travelTimeMinutes" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleCalendarEmail" TEXT;

-- CreateTable
CREATE TABLE "TravelRecommendation" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "recommendedDeparture" TIMESTAMP(3) NOT NULL,
    "recommendedArrival" TIMESTAMP(3) NOT NULL,
    "travelDuration" INTEGER NOT NULL,
    "trafficCondition" TEXT,
    "weatherCondition" TEXT,
    "addedToGame" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "autoFillEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultBufferMinutes" INTEGER NOT NULL DEFAULT 45,
    "busLoadingMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelRecommendation_gameId_idx" ON "TravelRecommendation"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelSettings_organizationId_key" ON "TravelSettings"("organizationId");

-- CreateIndex
CREATE INDEX "EmailGroup_userId_idx" ON "EmailGroup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailGroup_organizationId_name_key" ON "EmailGroup"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "TravelRecommendation" ADD CONSTRAINT "TravelRecommendation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelSettings" ADD CONSTRAINT "TravelSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
