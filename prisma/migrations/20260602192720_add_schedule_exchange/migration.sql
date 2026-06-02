-- CreateEnum
CREATE TYPE "GameRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'GAME_REQUEST_CONFIRM';

-- CreateTable
CREATE TABLE "SchedulePost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workbookId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "seasonStart" TIMESTAMP(3) NOT NULL,
    "seasonEnd" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameRequest" (
    "id" TEXT NOT NULL,
    "schedulePostId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "availableDate" TIMESTAMP(3) NOT NULL,
    "availableTimeWindow" TEXT,
    "sport" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "isHomeForRequester" BOOLEAN NOT NULL,
    "status" "GameRequestStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedByOwner" BOOLEAN NOT NULL DEFAULT false,
    "confirmedByRequester" BOOLEAN NOT NULL DEFAULT false,
    "syncedToWorkbookId" TEXT,
    "syncedGameId" TEXT,
    "readByOwner" BOOLEAN NOT NULL DEFAULT false,
    "readByRequester" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchedulePost_userId_idx" ON "SchedulePost"("userId");

-- CreateIndex
CREATE INDEX "SchedulePost_workbookId_idx" ON "SchedulePost"("workbookId");

-- CreateIndex
CREATE INDEX "SchedulePost_sport_level_gender_idx" ON "SchedulePost"("sport", "level", "gender");

-- CreateIndex
CREATE INDEX "SchedulePost_isActive_idx" ON "SchedulePost"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SchedulePost_userId_sport_level_gender_key" ON "SchedulePost"("userId", "sport", "level", "gender");

-- CreateIndex
CREATE INDEX "GameRequest_ownerUserId_status_idx" ON "GameRequest"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "GameRequest_requesterUserId_status_idx" ON "GameRequest"("requesterUserId", "status");

-- CreateIndex
CREATE INDEX "GameRequest_schedulePostId_idx" ON "GameRequest"("schedulePostId");

-- CreateIndex
CREATE INDEX "GameRequest_createdAt_idx" ON "GameRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "SchedulePost" ADD CONSTRAINT "SchedulePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchedulePost" ADD CONSTRAINT "SchedulePost_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "GamesWorkbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRequest" ADD CONSTRAINT "GameRequest_schedulePostId_fkey" FOREIGN KEY ("schedulePostId") REFERENCES "SchedulePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRequest" ADD CONSTRAINT "GameRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRequest" ADD CONSTRAINT "GameRequest_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
