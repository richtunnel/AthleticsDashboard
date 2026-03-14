-- AlterTable
ALTER TABLE "ConnectedParent" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "parentUserName" TEXT,
ADD COLUMN     "sportLevel" TEXT,
ADD COLUMN     "sportName" TEXT;
