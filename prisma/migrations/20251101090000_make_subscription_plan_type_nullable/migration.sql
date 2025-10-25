-- Make planType nullable in Subscription table to handle cases where plan type cannot be determined
ALTER TABLE "Subscription" ALTER COLUMN "planType" DROP NOT NULL;
