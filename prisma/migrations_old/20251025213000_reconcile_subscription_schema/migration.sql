-- Reconcile Subscription schema to match application code expectations
-- This migration:
-- 1. Adds userId to Subscription table (for one-to-one relationship with User)
-- 2. Changes status from TEXT to enum SubscriptionStatus
-- 3. Changes planType from TEXT to enum PlanType
-- 4. Adds priceId and stripeCustomerId fields
-- 5. Removes subscriptionId and subscriptionStatus from User table
-- 6. Updates the relationship between User and Subscription

-- First, handle any existing subscriptions without a clear user linkage
-- Delete any orphaned subscriptions that don't have a valid customerId
DELETE FROM "Subscription" WHERE "customerId" IS NULL OR "customerId" = '';

-- Add userId column (nullable initially to avoid constraint violations)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Populate userId based on User.stripeCustomerId matching Subscription.customerId
UPDATE "Subscription" s
SET "userId" = u."id"
FROM "User" u
WHERE u."stripeCustomerId" = s."customerId"
  AND s."userId" IS NULL;

-- Delete subscriptions that still don't have a userId (orphaned)
DELETE FROM "Subscription" WHERE "userId" IS NULL;

-- Add priceId and stripeCustomerId columns
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "priceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- Copy customerId to stripeCustomerId for consistency
UPDATE "Subscription" SET "stripeCustomerId" = "customerId" WHERE "stripeCustomerId" IS NULL;

-- Drop the old foreign key constraint if it exists
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_subscriptionId_fkey";

-- Drop the unique index on subscriptionId
DROP INDEX IF EXISTS "User_subscriptionId_key";

-- Drop subscriptionId and subscriptionStatus columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionStatus";

-- Convert status column to use enum
-- First, ensure all status values are uppercase and valid
UPDATE "Subscription" 
SET "status" = UPPER("status")
WHERE "status" IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');

-- Handle any invalid or NULL status values by setting to INCOMPLETE
UPDATE "Subscription" 
SET "status" = 'INCOMPLETE'
WHERE "status" IS NULL OR "status" NOT IN ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- Convert the status column to use the enum type
ALTER TABLE "Subscription" ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus";
ALTER TABLE "Subscription" ALTER COLUMN "status" SET NOT NULL;

-- Convert planType column to use enum
-- First, ensure all planType values are uppercase and valid
UPDATE "Subscription" 
SET "planType" = UPPER("planType")
WHERE "planType" IN ('monthly', 'annual');

-- Convert the planType column to use the enum type (nullable)
ALTER TABLE "Subscription" ALTER COLUMN "planType" TYPE "PlanType" USING "planType"::"PlanType";

-- Make userId NOT NULL and add unique constraint
ALTER TABLE "Subscription" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");

-- Add foreign key constraint from Subscription to User
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
