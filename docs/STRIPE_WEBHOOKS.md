# Stripe Webhooks Documentation

This document describes the Stripe webhook events handled by the Athletic Director Hub application.

## Overview

The application handles various Stripe webhook events to keep subscription and payment data in sync. The webhook endpoint is located at `/api/stripe/webhook`.

## Webhook Events

### 1. Subscription Events

#### customer.subscription.created

Triggered when a new subscription is created.

**Actions:**

- Creates or updates subscription record in database
- Links subscription to user
- Sends confirmation email
- Updates user's plan information

#### customer.subscription.updated

Triggered when a subscription is modified (e.g., plan change, status change).

**Actions:**

- Updates subscription record
- Syncs status changes
- Sends appropriate emails (confirmation or cancellation)
- Updates user's plan information

#### customer.subscription.deleted

Triggered when a subscription is cancelled or expires.

**Actions:**

- Marks subscription as cancelled
- Sends cancellation email
- Schedules account deletion based on grace period
- Updates user's access

### 2. Payment Events

#### invoice.payment_succeeded

Triggered when a payment is successfully processed.

**Actions:**

- Logs successful payment
- Identifies billing cycle (monthly/annual)
- Tracks payment amount
- Updates subscription status if needed

**Logged Information:**

- Subscription ID
- User ID
- Billing cycle (monthly/annual)
- Payment amount
- Invoice ID

#### invoice.payment_failed

Triggered when a payment fails.

**Actions:**

- Sends payment failure email to user
- Includes invoice URL and due date
- Logs failure for monitoring

### 3. Customer Events

#### customer.created

Triggered when a new customer is created in Stripe.

**Actions:**

- Links Stripe customer to user account
- Updates user's `stripeCustomerId`
- Detects if user is on free plan
- Logs customer creation

**Logged Information:**

- Customer ID
- User ID
- Email
- Current plan
- Whether user is on free plan

## Webhook Configuration

### Setup in Stripe Dashboard

1. Go to **Developers** → **Webhooks** in your Stripe dashboard
2. Click **Add endpoint**
3. Enter your webhook URL: `https://athleticdirectorhub.com/api/stripe/webhook`
4. Select the following events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.created`

5. Copy the signing secret
6. Add it to your `.env` file as `STRIPE_WEBHOOK_SECRET`

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID="price_your_monthly_price_id"
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID="price_your_annual_price_id"
```

## Webhook Security

### Signature Verification

The webhook endpoint verifies all incoming requests using Stripe's signature verification:

```typescript
const signature = req.headers.get("stripe-signature");
const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

If signature verification fails, the request is rejected with a 400 error.

### Best Practices

1. **Never disable signature verification** in production
2. **Keep webhook secret secure** - don't commit to version control
3. **Rotate secrets periodically** if there's any suspicion of compromise
4. **Monitor webhook logs** in Stripe dashboard for failed deliveries

## Idempotency

The webhook handler is designed to be idempotent:

- Uses `upsert` operations to safely handle duplicate events
- Tracks `lastEventId` to detect duplicate processing
- Safely handles events arriving out of order

## Event Data Flow

### Subscription Creation Flow

```
User signs up → Stripe subscription created
         ↓
customer.subscription.created webhook
         ↓
syncSubscription() → Database updated
         ↓
maybeSendConfirmationEmail() → Email sent
```

### Payment Success Flow

```
Recurring payment processed → Stripe charges customer
         ↓
invoice.payment_succeeded webhook
         ↓
handlePaymentSuccess() → Payment logged
         ↓
Billing cycle identified (monthly/annual)
         ↓
Console log with payment details
```

### Customer Creation Flow

```
User checkout → Stripe customer created
         ↓
customer.created webhook
         ↓
handleCustomerCreated() → User updated
         ↓
stripeCustomerId linked to user
         ↓
Free plan status detected and logged
```

## Monitoring and Logging

### What's Logged

All webhook events log the following:

- Event type
- Event ID
- Livemode status (test vs. production)
- Relevant IDs (subscription, customer, invoice)

### Specific Event Logs

**Payment Success:**

```javascript
console.info("stripe.webhook.payment_success", {
  subscriptionId: "sub_123",
  userId: "usr_456",
  billingCycle: "monthly",
  amount: 2900,
  invoiceId: "in_789",
});
```

**Customer Created:**

```javascript
console.info("stripe.webhook.customer_created", {
  customerId: "cus_123",
  userId: "usr_456",
  email: "user@example.com",
  plan: "free",
  isFreePlan: true,
});
```

### Monitoring in Production

1. **Stripe Dashboard**: Monitor webhook delivery status
2. **Application Logs**: Track successful processing
3. **Error Tracking**: Monitor for processing errors
4. **Database**: Verify subscription data is being updated

## Testing Webhooks

### Local Testing with Stripe CLI

1. Install Stripe CLI:

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:

   ```bash
   stripe login
   ```

3. Forward webhooks to local server:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Trigger test events:

   ```bash
   # Test subscription created
   stripe trigger customer.subscription.created

   # Test payment succeeded
   stripe trigger invoice.payment_succeeded

   # Test customer created
   stripe trigger customer.created
   ```

### Manual Testing

You can also trigger test events from the Stripe Dashboard:

1. Go to **Developers** → **Events**
2. Find a test event
3. Click **Send test webhook**

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL** is correct in Stripe dashboard
2. **Verify endpoint is accessible** from internet (not localhost for production)
3. **Check SSL certificate** is valid
4. **Review Stripe dashboard logs** for delivery attempts

### Signature Verification Failing

1. **Verify webhook secret** matches between Stripe and .env
2. **Check raw body** is being used (not parsed JSON)
3. **Ensure no middleware** is modifying the request body

### Events Processing But Database Not Updating

1. **Check database connection**
2. **Review application logs** for errors
3. **Verify Prisma schema** is up to date
4. **Check user/subscription lookup** is finding correct records

### Duplicate Event Processing

The system is designed to handle duplicates safely:

- Events are idempotent
- Database operations use `upsert`
- `lastEventId` tracks most recent event

If you see issues:

1. Check for race conditions
2. Verify transaction isolation
3. Review event timestamps

## Plan Detection

The webhook handler automatically detects plan types:

### Monthly Plans

Detected by keywords in:

- Price nickname: "month", "monthly"
- Lookup key: "month", "monthly"

### Annual Plans

Detected by keywords in:

- Price nickname: "annual", "year", "yearly"
- Lookup key: "annual", "year", "yearly"

### Free Plans

Detected by:

- User has no active subscription
- Plan field is "free", "free_plan", or null
- No Stripe subscription ID

## Email Notifications

The webhook system sends automatic emails for:

1. **Subscription Confirmation**
   - Sent when subscription becomes active or trialing
   - Includes plan details and period end date

2. **Subscription Cancellation**
   - Sent when subscription is cancelled
   - Includes access end date

3. **Payment Failure**
   - Sent when payment fails
   - Includes invoice link and retry date

## Related Documentation

- [Stripe Subscription Documentation](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
