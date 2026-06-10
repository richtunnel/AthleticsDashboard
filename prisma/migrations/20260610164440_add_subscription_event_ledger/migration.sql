-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastEventTimestamp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "stripeStatus" TEXT,
    "stripeEventCreatedAt" TIMESTAMP(3) NOT NULL,
    "priceId" TEXT,
    "planType" "PlanType",
    "billingCycle" TEXT,
    "amountPaid" INTEGER,
    "currency" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_userId_stripeEventCreatedAt_idx" ON "SubscriptionEvent"("userId", "stripeEventCreatedAt");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_stripeSubscriptionId_idx" ON "SubscriptionEvent"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
