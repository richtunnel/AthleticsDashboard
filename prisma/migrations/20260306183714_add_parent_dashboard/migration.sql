-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PARENT';

-- CreateTable
CREATE TABLE "ParentAthleteLink" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "athleteName" TEXT NOT NULL,
    "athleteEmail" TEXT,
    "teamName" TEXT,
    "sport" TEXT,
    "gradeLevel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAthleteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentSubscription" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "parentAthleteLinkId" TEXT NOT NULL,
    "subscriptionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedParent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedParent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentAthleteLink_athleteEmail_key" ON "ParentAthleteLink"("athleteEmail");

-- CreateIndex
CREATE INDEX "ParentAthleteLink_parentUserId_idx" ON "ParentAthleteLink"("parentUserId");

-- CreateIndex
CREATE INDEX "ParentAthleteLink_schoolId_idx" ON "ParentAthleteLink"("schoolId");

-- CreateIndex
CREATE INDEX "ParentAthleteLink_athleteEmail_idx" ON "ParentAthleteLink"("athleteEmail");

-- CreateIndex
CREATE INDEX "ParentSubscription_parentUserId_idx" ON "ParentSubscription"("parentUserId");

-- CreateIndex
CREATE INDEX "ParentSubscription_parentAthleteLinkId_idx" ON "ParentSubscription"("parentAthleteLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSubscription_parentUserId_parentAthleteLinkId_key" ON "ParentSubscription"("parentUserId", "parentAthleteLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedParent_email_key" ON "ConnectedParent"("email");

-- CreateIndex
CREATE INDEX "ConnectedParent_schoolId_idx" ON "ConnectedParent"("schoolId");

-- AddForeignKey
ALTER TABLE "ParentAthleteLink" ADD CONSTRAINT "ParentAthleteLink_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAthleteLink" ADD CONSTRAINT "ParentAthleteLink_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSubscription" ADD CONSTRAINT "ParentSubscription_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSubscription" ADD CONSTRAINT "ParentSubscription_parentAthleteLinkId_fkey" FOREIGN KEY ("parentAthleteLinkId") REFERENCES "ParentAthleteLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedParent" ADD CONSTRAINT "ConnectedParent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
