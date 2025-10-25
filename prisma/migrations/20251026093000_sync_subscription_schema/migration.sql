-- Align Subscription schema and data with application expectations

DO $$
BEGIN
  ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'FREE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "planType" "PlanType",
  ADD COLUMN IF NOT EXISTS "billingCycle" TEXT,
  ADD COLUMN IF NOT EXISTS "priceId" TEXT,
  ADD COLUMN IF NOT EXISTS "planProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "planLookupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "planNickname" TEXT,
  ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "latestInvoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastEventId" TEXT;

ALTER TABLE "Subscription"
  ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "Subscription"
  ALTER COLUMN "cancelAtPeriodEnd" SET DEFAULT false;

UPDATE "Subscription"
SET "cancelAtPeriodEnd" = false
WHERE "cancelAtPeriodEnd" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription'
      AND column_name = 'status'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "Subscription"
      ALTER COLUMN "status" TYPE "SubscriptionStatus"
      USING CASE
        WHEN "status" IN ('INCOMPLETE', 'INCOMPLETE_EXPIRED', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID') THEN "status"::"SubscriptionStatus"
        ELSE 'INCOMPLETE'
      END;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'subscription'
      AND column_name = 'planType'
      AND udt_name = 'text'
  ) THEN
    ALTER TABLE "Subscription"
      ALTER COLUMN "planType" TYPE "PlanType"
      USING CASE
        WHEN "planType" IN ('FREE', 'MONTHLY', 'ANNUAL') THEN "planType"::"PlanType"
        ELSE NULL
      END;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_userId_fkey'
  ) THEN
    ALTER TABLE "Subscription"
      ADD CONSTRAINT "Subscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
