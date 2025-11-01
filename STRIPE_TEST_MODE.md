# Stripe Test Mode Setup

This document provides a quick overview of Stripe test mode features in this application.

## Overview

The application includes built-in support for Stripe test mode with the following enhancements:

- ✅ Automatic test mode detection based on API keys
- 🔍 Enhanced debugging and logging
- 🏷️ Test-specific metadata on all Stripe objects
- ⚡ Configurable trial periods for faster testing
- 📊 Visual test mode indicators in the UI
- 🎯 Comprehensive test documentation

## Quick Start

See [docs/STRIPE_QUICK_START.md](./docs/STRIPE_QUICK_START.md) for a 5-minute setup guide.

## Features

### Automatic Test Mode Detection

The application automatically detects test mode based on your API keys:
- Test keys start with `sk_test_`
- Production keys start with `sk_live_`

No manual configuration needed!

### Enhanced Logging

When in test mode, all Stripe operations are logged to the console:

```
[Stripe Test Mode] Stripe client initialized { mode: "test", apiVersion: "2025-09-30.clover" }
[Stripe Test Mode] Creating checkout session { userId: "...", planType: "MONTHLY", trialEligible: true }
[Stripe Test Mode] Checkout session created { sessionId: "cs_...", customerId: "cus_..." }
[Stripe Test Mode] Webhook received { eventType: "customer.subscription.created", eventId: "evt_..." }
```

This makes debugging much easier during development.

### Test Metadata

All Stripe objects (customers, subscriptions, checkout sessions) created in test mode automatically include metadata:

```json
{
  "test_mode": "true",
  "test_environment": "development",
  "test_timestamp": "2024-01-15T10:30:00Z"
}
```

This helps identify test transactions in the Stripe dashboard.

### Configurable Trial Periods

By default, subscriptions include a 14-day trial. In test mode, you can override this for faster testing:

```env
# .env.local
STRIPE_TEST_TRIAL_DAYS=1  # 1-day trial for testing
```

### Visual Indicators

The application shows a test mode banner on the plans page when using test keys:

> ⚠️ **Stripe Test Mode Active**  
> You're using test mode. Use test card `4242 4242 4242 4242` for checkout. Real charges will not be made.

This only appears in non-production environments.

### Promotion Codes Enabled

In test mode, promotion codes are automatically enabled in checkout sessions for easier testing of discount scenarios.

## Test Cards

Use these cards to test different scenarios:

| Card | Purpose |
|------|---------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Generic decline |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |

**For all cards:**
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any valid postal code

## Configuration Files

### New Files

- **`src/lib/stripe-config.ts`** - Test mode detection and configuration
- **`src/components/stripe/TestModeIndicator.tsx`** - UI component for test mode banner
- **`docs/STRIPE_TEST_MODE_GUIDE.md`** - Comprehensive testing guide
- **`docs/STRIPE_QUICK_START.md`** - Quick 5-minute setup guide

### Enhanced Files

- **`src/lib/stripe.ts`** - Added test mode logging
- **`src/app/api/stripe/checkout/route.ts`** - Test mode metadata and logging
- **`src/app/api/stripe/create-checkout-session/route.ts`** - Test mode support
- **`src/app/api/stripe/webhook/route.ts`** - Enhanced webhook logging
- **`src/app/onboarding/plans/page.tsx`** - Test mode indicator

## API Reference

### Utility Functions

```typescript
import { 
  isStripeTestMode,
  getStripeConfig,
  validateStripeConfig,
  logTestModeInfo,
  getTestModeMetadata,
  getTrialPeriodDays,
  TEST_CARDS
} from '@/lib/stripe-config';

// Check if in test mode
const isTest = isStripeTestMode(); // true if using sk_test_ key

// Get full config
const config = getStripeConfig();
// { secretKey, webhookSecret, monthlyPriceId, annualPriceId, isTestMode }

// Validate configuration
const { valid, missing } = validateStripeConfig();

// Log test mode info (only logs in test mode)
logTestModeInfo("Operation name", { key: "value" });

// Get metadata with test mode tags
const metadata = getTestModeMetadata({ userId: "123" });
// { userId: "123", test_mode: "true", test_environment: "development", ... }

// Get trial period (respects STRIPE_TEST_TRIAL_DAYS in test mode)
const days = getTrialPeriodDays(); // 14 or custom value

// Access test card numbers
console.log(TEST_CARDS.success); // "4242424242424242"
```

### UI Components

```tsx
import { TestModeIndicator, TestCardReference } from '@/components/stripe/TestModeIndicator';

// Banner with test cards
<TestModeIndicator variant="banner" />

// Small chip
<TestModeIndicator variant="chip" />

// Subtle inline indicator
<TestModeIndicator variant="subtle" />

// Test card reference guide
<TestCardReference />
```

## Testing Workflows

### Local Development with Webhooks

```bash
# Terminal 1: Start the app
yarn dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook secret from Terminal 2 and add to `.env.local`:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Testing a Complete Subscription Flow

1. Navigate to `/onboarding/plans`
2. Select a plan (Monthly or Annual)
3. Click "Get started"
4. Use test card `4242 4242 4242 4242`
5. Complete checkout
6. Verify in:
   - Browser console (test mode logs)
   - Terminal running `stripe listen` (webhook events)
   - Database (subscription record created)
   - Stripe dashboard (test transaction)

### Testing Cancellations

1. Create an active subscription (follow above)
2. Go to `/dashboard/settings`
3. Click "Cancel Subscription"
4. Choose cancellation timing
5. Verify webhook received and database updated

### Testing Payment Failures

1. Start checkout flow
2. Use card `4000 0000 0000 0002`
3. Verify error handling
4. Try with `4000 0000 0000 9995` (insufficient funds)
5. Check different error messages

## Documentation

- **Quick Start**: [docs/STRIPE_QUICK_START.md](./docs/STRIPE_QUICK_START.md)
- **Comprehensive Guide**: [docs/STRIPE_TEST_MODE_GUIDE.md](./docs/STRIPE_TEST_MODE_GUIDE.md)
- **Webhook Testing**: [docs/stripe-webhook-test-plan.md](./docs/stripe-webhook-test-plan.md)
- **Implementation**: [SUBSCRIPTION_IMPLEMENTATION.md](./SUBSCRIPTION_IMPLEMENTATION.md)

## Production Checklist

Before deploying to production:

- [ ] Update `STRIPE_SECRET_KEY` to production key (`sk_live_...`)
- [ ] Update `STRIPE_WEBHOOK_SECRET` to production webhook secret
- [ ] Update price IDs to production prices
- [ ] Configure production webhook endpoint in Stripe dashboard
- [ ] Test with production mode API keys in staging environment
- [ ] Verify test mode indicators are hidden in production (`NODE_ENV=production`)
- [ ] Review Stripe dashboard to ensure no test data in production

## Best Practices

1. **Never mix test and production data** - Use separate databases for testing
2. **Always use test keys in development** - Keep production keys secure
3. **Test all scenarios** - Success, failures, cancellations, plan changes
4. **Monitor logs** - Watch for test mode logs during development
5. **Clean up test data** - Periodically remove old test subscriptions
6. **Document test results** - Keep track of what's been tested

## Troubleshooting

### "Webhook signature verification failed"
Ensure `STRIPE_WEBHOOK_SECRET` matches the one from `stripe listen`

### "No test mode logs appearing"
Check that `STRIPE_SECRET_KEY` starts with `sk_test_`

### "Price not found"
Verify price IDs are from test mode and not archived

See [docs/STRIPE_TEST_MODE_GUIDE.md](./docs/STRIPE_TEST_MODE_GUIDE.md) for more troubleshooting tips.

## Support

- Stripe Testing Docs: https://stripe.com/docs/testing
- Stripe CLI: https://stripe.com/docs/cli
- Stripe Webhooks: https://stripe.com/docs/webhooks
- Application Docs: See `/docs` directory
