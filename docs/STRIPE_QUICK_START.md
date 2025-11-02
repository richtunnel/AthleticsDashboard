# Stripe Test Mode - Quick Start Guide

This is a condensed guide to get you testing subscription checkout quickly. For comprehensive documentation, see [STRIPE_TEST_MODE_GUIDE.md](./STRIPE_TEST_MODE_GUIDE.md).

## 5-Minute Setup

### 1. Configure Environment Variables

Update your `.env.local` file:

```env
# Get these from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Get these from https://dashboard.stripe.com/test/products
# Note: You can set either the server-side OR the public versions (or both).
# The backend will automatically detect and use whichever is configured.
STRIPE_MONTHLY_PRICE_ID=price_YOUR_MONTHLY_PRICE_ID
STRIPE_ANNUAL_PRICE_ID=price_YOUR_ANNUAL_PRICE_ID

# Public keys (required for frontend, but backend can also use these if server-side vars not set)
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_YOUR_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_YOUR_ANNUAL_PRICE_ID

# Optional: Faster testing (reduce trial from 14 days to 1 day)
STRIPE_TEST_TRIAL_DAYS=1
```

### 2. Create Test Products in Stripe

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Create two prices:
   - **Monthly**: $40/month
   - **Annual**: $250/year
4. Copy the Price IDs and update your `.env.local`

### 3. Setup Webhook Testing

```bash
# Install Stripe CLI (if not installed)
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to your local app
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook secret (`whsec_...`) from the CLI output and add it to `.env.local`

### 4. Start Your App

```bash
# Install dependencies (if not already done)
yarn install

# Run database migrations
yarn prisma migrate dev

# Start the dev server
yarn dev
```

### 5. Test Checkout

1. Navigate to: http://localhost:3000/onboarding/plans
2. Select a plan (Monthly or Annual)
3. Click "Get started"
4. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/34)
   - CVC: Any 3 digits (e.g., 123)
5. Complete checkout
6. Verify success in:
   - Application console (look for `[Stripe Test Mode]` logs)
   - Stripe CLI (webhook received)
   - Database (subscription created)

## Essential Test Cards

| Purpose      | Card Number           |
| ------------ | --------------------- |
| ✅ Success   | `4242 4242 4242 4242` |
| ❌ Decline   | `4000 0000 0000 0002` |
| 🔐 3D Secure | `4000 0025 0000 3155` |

All cards:

- **Expiry**: Any future date
- **CVC**: Any 3 digits
- **ZIP**: Any valid ZIP

## Common Issues

### "Webhook signature verification failed"

➡️ Make sure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the CLI output

### "Missing price ID"

➡️ Check that `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` and `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` are set

### "No test mode logs appearing"

➡️ Verify your `STRIPE_SECRET_KEY` starts with `sk_test_`

### Checkout fails silently

➡️ Check the browser console and server logs for errors

## Test Mode Features

✨ **Auto-detected**: Test mode is automatically detected from your API keys

🔍 **Enhanced Logging**: All Stripe operations log to console with `[Stripe Test Mode]` prefix

🏷️ **Test Metadata**: Test transactions are tagged with metadata for easy identification

📊 **Stripe Dashboard**: View all test transactions at https://dashboard.stripe.com/test/payments

## Key Test Scenarios

- [ ] **New user with trial**: First subscription gets 14-day trial
- [ ] **Existing user**: No trial on subsequent subscriptions
- [ ] **Payment failure**: Use decline card and verify error handling
- [ ] **Cancellation**: Cancel subscription and verify grace period
- [ ] **Plan change**: Switch between Monthly/Annual plans

## Monitoring Test Mode

### Application Logs

Look for these log entries:

```
[Stripe Test Mode] Stripe client initialized
[Stripe Test Mode] Creating checkout session
[Stripe Test Mode] Checkout session created
[Stripe Test Mode] Webhook received
```

### Stripe Dashboard

- Payments: https://dashboard.stripe.com/test/payments
- Subscriptions: https://dashboard.stripe.com/test/subscriptions
- Webhooks: https://dashboard.stripe.com/test/webhooks
- Logs: https://dashboard.stripe.com/test/logs

### Database

Check tables:

- `User` - `stripeCustomerId`, `hasReceivedFreeTrial`
- `Subscription` - `status`, `stripeSubscriptionId`, trial dates

## Next Steps

- **Comprehensive Testing**: See [STRIPE_TEST_MODE_GUIDE.md](./STRIPE_TEST_MODE_GUIDE.md)
- **Webhook Testing**: Review [stripe-webhook-test-plan.md](./stripe-webhook-test-plan.md)
- **Production Setup**: Switch to production keys when ready (starts with `sk_live_`)

## Need Help?

1. Check console logs for detailed error messages
2. Review Stripe Dashboard event logs
3. Consult the comprehensive guide: [STRIPE_TEST_MODE_GUIDE.md](./STRIPE_TEST_MODE_GUIDE.md)
4. Stripe docs: https://stripe.com/docs/testing
