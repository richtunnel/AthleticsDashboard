-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CalendarSyncRequest" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sportName" TEXT NOT NULL,
    "sportLevel" TEXT NOT NULL,
    "status" "CalendarSyncStatus" NOT NULL DEFAULT 'PENDING',
    "googleCalendarId" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "CalendarSyncRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_parentUserId_idx" ON "CalendarSyncRequest"("parentUserId");

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_schoolId_idx" ON "CalendarSyncRequest"("schoolId");

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_status_idx" ON "CalendarSyncRequest"("status");

-- AddForeignKey
ALTER TABLE "CalendarSyncRequest" ADD CONSTRAINT "CalendarSyncRequest_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRequest" ADD CONSTRAINT "CalendarSyncRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
