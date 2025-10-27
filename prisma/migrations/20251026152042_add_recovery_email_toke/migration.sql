-- AlterTable
ALTER TABLE "RecoveryEmail" ADD COLUMN     "token" TEXT,
ADD COLUMN     "tokenExpiry" TIMESTAMP(3);
