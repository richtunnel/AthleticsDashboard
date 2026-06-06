-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signatureDisclaimer" TEXT,
ADD COLUMN     "signatureDisclaimerEnabled" BOOLEAN NOT NULL DEFAULT false;
