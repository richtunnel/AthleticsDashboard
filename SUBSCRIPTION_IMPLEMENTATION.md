# Subscription Flow Implementation

This document describes the subscription and checkout flow implementation for the Athletics Dashboard application.

## Overview

The subscription system uses Stripe Checkout for payment processing and implements a production-ready subscription flow with:

- Monthly and annual plan options
- Trial eligibility tracking
- Subscription lifecycle management
- Customer portal integration
- Webhook-driven state management

## Architecture

### Database Schema

#### Subscription Model

```prisma
model Subscription {
  id                    String              @id @default(cuid())
  userId                String              @unique
  user                  User                @relation(fields: [userId], references: [id])
  stripeSubscriptionId  String?             @unique
  stripeCustomerId      String?
  status                SubscriptionStatus  @default(INCOMPLETE)
  planType              PlanType?
  priceId               String?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAt              DateTime?
  canceledAt            DateTime?
  trialStart            DateTime?
  trialEnd              DateTime?
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt
}
```

#### User Model Updates

- Added `hasReceivedFreeTrial` boolean flag (default: false)
- Maintains relation to `Subscription` model

### API Routes

#### POST /api/stripe/checkout

Creates a Stripe Checkout Session for subscription signup.

**Request Body:**

```typescript
{
  planType: "MONTHLY" | "ANNUAL";
}
```

**Response:**

```typescript
{
  sessionId: string;
  url: string;
  trialEligible: boolean;
}
```

**Features:**

- Creates/updates Subscription record with status "INCOMPLETE"
- Checks trial eligibility based on `hasReceivedFreeTrial` flag
- Creates Stripe customer if needed
- Sets up 14-day trial for eligible users
- Includes metadata for webhook processing

#### POST /api/stripe/cancel

Cancels an active subscription.

**Request Body:**

```typescript
{
  immediately?: boolean; // default: false
}
```

**Response:**

```typescript
{
  success: boolean;
  message: string;
  subscription: {
    status: SubscriptionStatus;
    cancelAt: DateTime | null;
    currentPeriodEnd: DateTime | null;
  }
}
```

**Behavior:**

- If `immediately` is false: cancels at end of billing period
- If `immediately` is true: cancels immediately
- Updates local Subscription record

#### POST /api/stripe/change-plan

Changes subscription plan type (monthly ↔ annual).

**Request Body:**

```typescript
{
  planType: "MONTHLY" | "ANNUAL";
}
```

**Response:**

```typescript
{
  success: boolean;
  message: string;
  planType: PlanType;
}
```

**Features:**

- Uses proration for immediate plan changes
- Updates price ID in Stripe
- Syncs changes to local Subscription record

#### POST /api/stripe/portal

Generates a Stripe Customer Portal URL.

**Response:**

```typescript
{
  url: string;
}
```

**Features:**

- Creates portal session for subscription management
- Returns to `/dashboard/settings` after portal actions
- Auto-creates customer if needed

#### POST /api/stripe/webhook

Handles Stripe webhook events.

**Supported Events:**

- `checkout.session.completed` - Completes subscription setup
- `customer.subscription.updated` - Syncs subscription changes
- `customer.subscription.deleted` - Handles cancellations
- `customer.subscription.trial_will_end` - Logged for notifications

## Environment Variables

Required environment variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_your_monthly_price_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_your_annual_price_id
```

## Onboarding Flow

### Plans Page (`/onboarding/plans`)

1. User selects billing frequency (monthly/annual)
2. User clicks "Get started" on a plan
3. For free trial: redirects to `/onboarding/signup?plan=free_trial_plan`
4. For paid plans: calls `/api/stripe/checkout` and redirects to Stripe

### Checkout Process

1. User lands on Stripe Checkout page
2. Enters payment information
3. On success: redirects to `/onboarding/details?session_id={CHECKOUT_SESSION_ID}`
4. On cancel: redirects to `/onboarding/plans?canceled=true`

### Webhook Processing

1. Stripe sends `checkout.session.completed` event
2. Webhook handler updates Subscription record with:
   - Stripe subscription ID
   - Status (TRIALING or ACTIVE)
   - Current period dates
   - Trial dates (if applicable)
3. Updates User record with:
   - Plan type
   - Trial end date
   - `hasReceivedFreeTrial` set to true

## Trial Eligibility

### Rules

- Users are eligible for a 14-day trial if `hasReceivedFreeTrial` is false
- Trial eligibility is checked during checkout session creation
- Once a user receives a trial, `hasReceivedFreeTrial` is set to true
- Trial flag is set by webhook when subscription enters trialing state

### UI Messaging

- Plans page should display trial availability
- Checkout should inform users if they're not eligible for trial
- Settings page should show trial end date during trial period

## Subscription States

### Status Enum Values

- `INCOMPLETE` - Checkout started but not completed
- `INCOMPLETE_EXPIRED` - Checkout expired without completion
- `TRIALING` - In trial period
- `ACTIVE` - Active paid subscription
- `PAST_DUE` - Payment failed
- `CANCELED` - Subscription canceled
- `UNPAID` - Multiple payment failures

### State Transitions

```
INCOMPLETE → TRIALING → ACTIVE
INCOMPLETE → ACTIVE (no trial)
ACTIVE → PAST_DUE (payment failure)
ACTIVE → CANCELED (cancellation)
PAST_DUE → ACTIVE (payment recovered)
PAST_DUE → UNPAID (too many failures)
```

## Error Handling

### Client-Side

- Loading states during API calls
- User-friendly error messages
- Retry mechanisms for transient failures
- Fallback to plans page on critical errors

### Server-Side

- Zod validation for all request bodies
- Comprehensive error logging
- Graceful degradation for missing config
- Webhook signature verification
- Database transaction safety

## Testing Checklist

### Checkout Flow

- [ ] Monthly plan creates checkout session
- [ ] Annual plan creates checkout session
- [ ] Trial is applied for new users
- [ ] Trial is not applied for users who had trial
- [ ] Subscription record created with INCOMPLETE status
- [ ] Webhook updates subscription to TRIALING/ACTIVE
- [ ] User record updated with plan and trial info

### Cancellation

- [ ] Cancel at period end works
- [ ] Immediate cancel works
- [ ] Subscription record updated
- [ ] User can resubscribe after cancel

### Plan Changes

- [ ] Monthly to annual upgrade works
- [ ] Annual to monthly downgrade works
- [ ] Proration calculated correctly
- [ ] Subscription record updated

### Portal

- [ ] Portal URL generated
- [ ] User can manage payment methods
- [ ] User can view invoices
- [ ] User can cancel subscription
- [ ] Portal changes sync via webhook

## Security Considerations

- All endpoints require authentication
- Webhook signature verification enforced
- Idempotency keys used for checkout sessions
- User metadata included in Stripe objects
- Customer IDs validated before use

## Future Enhancements

- [ ] Add subscription analytics
- [ ] Implement usage-based billing
- [ ] Add coupon/promo code support
- [ ] Email notifications for trial ending
- [ ] Invoice PDF generation
- [ ] Multiple subscription tiers
- [ ] Add-on products/features
- [ ] Grace period for failed payments
