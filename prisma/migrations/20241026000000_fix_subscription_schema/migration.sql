-- Fix Subscription schema: make customerId optional to match application usage
-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "customerId" DROP NOT NULL;
