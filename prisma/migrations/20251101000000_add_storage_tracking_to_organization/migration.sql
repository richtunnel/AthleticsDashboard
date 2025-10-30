-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "storageUsageBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "storageQuotaBytes" BIGINT NOT NULL DEFAULT 1073741824,
ADD COLUMN     "lastStorageCalculation" TIMESTAMP(3);
