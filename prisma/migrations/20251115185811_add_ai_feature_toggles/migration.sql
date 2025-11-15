-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiSchedulerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "aiTravelTimesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "aiEmailGenerationEnabled" BOOLEAN NOT NULL DEFAULT false;
