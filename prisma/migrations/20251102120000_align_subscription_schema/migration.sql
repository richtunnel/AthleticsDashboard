-- Align subscription schema with new application expectations
-- Add new relational fields and migrate existing data

-- Step 1: extend the Subscription table with the new columns
ALTER TABLE "Subscription"
    ADD COLUMN "userId" TEXT,
    ADD COLUMN "stripeSubscriptionId" TEXT,
    ADD COLUMN "stripeCustomerId" TEXT,
    ADD COLUMN "planType" "PlanType",
    ADD COLUMN "billingCycle" TEXT,
    ADD COLUMN "priceId" TEXT,
    ADD COLUMN "gracePeriodEndsAt" TIMESTAMP(3),
    ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);

-- Step 2: introduce an enum-backed status column that mirrors existing values
ALTER TABLE "Subscription"
    ADD COLUMN "status_tmp" "SubscriptionStatus";

-- Step 3: seed the new columns from existing data
UPDATE "Subscription" AS s
SET
    "stripeSubscriptionId" = s."id",
    "stripeCustomerId"    = s."customerId",
    "priceId"             = s."planPriceId";

UPDATE "Subscription" AS s
SET
    "planType" = CASE
        WHEN s."planLookupKey" ILIKE '%annual%' OR s."planNickname" ILIKE '%annual%' OR s."planPriceId" ILIKE '%annual%' OR s."planLookupKey" ILIKE '%year%' OR s."planNickname" ILIKE '%year%' OR s."planPriceId" ILIKE '%year%'
          THEN 'ANNUAL'::"PlanType"
        WHEN s."planLookupKey" ILIKE '%month%' OR s."planNickname" ILIKE '%month%' OR s."planPriceId" ILIKE '%month%'
          THEN 'MONTHLY'::"PlanType"
        ELSE NULL
    END,
    "billingCycle" = CASE
        WHEN s."planLookupKey" ILIKE '%annual%' OR s."planNickname" ILIKE '%annual%' OR s."planPriceId" ILIKE '%annual%' OR s."planLookupKey" ILIKE '%year%' OR s."planNickname" ILIKE '%year%' OR s."planPriceId" ILIKE '%year%'
          THEN 'ANNUAL'
        WHEN s."planLookupKey" ILIKE '%month%' OR s."planNickname" ILIKE '%month%' OR s."planPriceId" ILIKE '%month%'
          THEN 'MONTHLY'
        ELSE NULL
    END;

UPDATE "Subscription" AS s
SET
    "userId"              = u."id",
    "deletionScheduledAt" = COALESCE(s."deletionScheduledAt", u."deletionScheduledAt")
FROM "User" AS u
WHERE u."subscriptionId" = s."id";

UPDATE "Subscription" AS s
SET "stripeCustomerId" = COALESCE(s."stripeCustomerId", u."stripeCustomerId")
FROM "User" AS u
WHERE u."id" = s."userId";

UPDATE "Subscription"
SET "status_tmp" = CASE
    WHEN "status" IS NULL THEN NULL
    WHEN upper("status") = 'INCOMPLETE' THEN 'INCOMPLETE'::"SubscriptionStatus"
    WHEN upper("status") = 'INCOMPLETE_EXPIRED' THEN 'INCOMPLETE_EXPIRED'::"SubscriptionStatus"
    WHEN upper("status") = 'TRIALING' THEN 'TRIALING'::"SubscriptionStatus"
    WHEN upper("status") = 'ACTIVE' THEN 'ACTIVE'::"SubscriptionStatus"
    WHEN upper("status") = 'PAST_DUE' THEN 'PAST_DUE'::"SubscriptionStatus"
    WHEN upper("status") = 'CANCELED' THEN 'CANCELED'::"SubscriptionStatus"
    WHEN upper("status") = 'CANCELLED' THEN 'CANCELED'::"SubscriptionStatus"
    WHEN upper("status") = 'UNPAID' THEN 'UNPAID'::"SubscriptionStatus"
    ELSE 'INCOMPLETE'::"SubscriptionStatus"
END;

UPDATE "Subscription"
SET "status_tmp" = 'INCOMPLETE'::"SubscriptionStatus"
WHERE "status_tmp" IS NULL;

-- Step 4: remove orphaned subscriptions before enforcing the new constraint
DELETE FROM "Subscription"
WHERE "userId" IS NULL;

-- Step 5: enforce NOT NULL constraints on the new required columns
ALTER TABLE "Subscription"
    ALTER COLUMN "userId" SET NOT NULL,
    ALTER COLUMN "status_tmp" SET NOT NULL;

-- Step 6: replace the legacy status column with the enum-backed column
ALTER TABLE "Subscription"
    DROP COLUMN "status";

ALTER TABLE "Subscription"
    RENAME COLUMN "status_tmp" TO "status";

-- Step 7: remove legacy Stripe plan columns now that data is migrated
ALTER TABLE "Subscription"
    DROP COLUMN "customerId",
    DROP COLUMN "planPriceId",
    DROP COLUMN "planProductId",
    DROP COLUMN "planLookupKey",
    DROP COLUMN "planNickname";

-- Step 8: rebuild relational constraints and indexes
ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- Step 9: drop legacy subscription pointers from the User table
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_subscriptionId_fkey";
DROP INDEX IF EXISTS "User_subscriptionId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "User" DROP COLUMN IF EXISTS "cancellationDate";
ALTER TABLE "User" DROP COLUMN IF EXISTS "deletionScheduledAt";
