-- AlterTable
ALTER TABLE "ConnectedParent" ADD COLUMN     "schoolEntityId" TEXT;

-- AlterTable
ALTER TABLE "ParentAthleteLink" ADD COLUMN     "schoolEntityId" TEXT;

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "mascot" TEXT,
    "state" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "School_organizationId_idx" ON "School"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectedParent_schoolEntityId_idx" ON "ConnectedParent"("schoolEntityId");

-- CreateIndex
CREATE INDEX "ParentAthleteLink_schoolEntityId_idx" ON "ParentAthleteLink"("schoolEntityId");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAthleteLink" ADD CONSTRAINT "ParentAthleteLink_schoolEntityId_fkey" FOREIGN KEY ("schoolEntityId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedParent" ADD CONSTRAINT "ConnectedParent_schoolEntityId_fkey" FOREIGN KEY ("schoolEntityId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
