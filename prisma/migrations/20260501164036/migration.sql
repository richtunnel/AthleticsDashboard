/*
  Warnings:

  - The primary key for the `EmailLog` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_SUCCESS');

-- CreateEnum
CREATE TYPE "EmailRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "CalendarSyncStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_pkey",
ADD COLUMN     "replyTo" TEXT,
ADD CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id", "createdAt");

-- CreateTable
CREATE TABLE "EmailJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyTo" TEXT,
    "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "gameIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupId" TEXT,
    "campaignId" TEXT,
    "recipientCategory" TEXT,
    "additionalMessage" TEXT,
    "visibleColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectedSchoolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRecipient" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),

    CONSTRAINT "EmailRecipient_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "EmailJob_userId_idx" ON "EmailJob"("userId");

-- CreateIndex
CREATE INDEX "EmailJob_organizationId_idx" ON "EmailJob"("organizationId");

-- CreateIndex
CREATE INDEX "EmailJob_status_idx" ON "EmailJob"("status");

-- CreateIndex
CREATE INDEX "EmailRecipient_jobId_idx" ON "EmailRecipient"("jobId");

-- CreateIndex
CREATE INDEX "EmailRecipient_status_idx" ON "EmailRecipient"("status");

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_parentUserId_idx" ON "CalendarSyncRequest"("parentUserId");

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_schoolId_idx" ON "CalendarSyncRequest"("schoolId");

-- CreateIndex
CREATE INDEX "CalendarSyncRequest_status_idx" ON "CalendarSyncRequest"("status");

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailRecipient" ADD CONSTRAINT "EmailRecipient_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "EmailJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRequest" ADD CONSTRAINT "CalendarSyncRequest_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRequest" ADD CONSTRAINT "CalendarSyncRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
