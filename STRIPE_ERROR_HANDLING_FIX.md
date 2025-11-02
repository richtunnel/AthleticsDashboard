# Stripe Error Handling Fix - "No Such Price" Issue

## Problem Description

When attempting to create a checkout session with a Stripe price ID that doesn't exist in the Stripe account, the application would return a generic 500 error:

```
create-checkout-session.error [Error: No such price: 'price_1SOxlkPoFQ98Rxs6M7QvtUhM']
POST /api/stripe/create-checkout-session 500
```

This occurred when:

1. The price ID configured in environment variables doesn't exist in the Stripe account
2. The environment is using test mode keys but price IDs from a different Stripe account
3. The price IDs were deleted from Stripe after being configured

## Root Cause

The API routes (`/api/stripe/create-checkout-session`, `/api/stripe/checkout`, and `/api/stripe/change-plan`) were not specifically handling Stripe's `resource_missing` error (error code `resource_missing`, type `StripeInvalidRequestError`).

When Stripe couldn't find the specified price ID, it would throw this error, which was caught by the generic error handler and returned as a 500 error with a vague message.

## Solution Implemented

### 1. Proactive Price Validation

Added price validation **before** attempting to create checkout sessions or update subscriptions:

```typescript
// Validate that the price exists in Stripe before creating checkout session
try {
  await stripe.prices.retrieve(priceId);
} catch (priceError: any) {
  if (priceError.type === "StripeInvalidRequestError" && priceError.code === "resource_missing") {
    // Return helpful error message with setup instructions
    return NextResponse.json({ error: "..." }, { status: 400 });
  }
  // Log but continue if it's a different error (transient network issues)
  console.warn(`Failed to validate price ${priceId}, continuing anyway:`, priceError);
}
```

### 2. Enhanced Error Messages

The error messages now:

- Show the exact price ID that's missing
- Indicate whether the app is in test or live mode
- Provide direct links to the appropriate Stripe Dashboard
- List the specific environment variables that need to be updated
- Reference the setup documentation (`docs/STRIPE_QUICK_START.md`)

**Development Mode Example:**

```
The Stripe price ID "price_1SOxlkPoFQ98Rxs6M7QvtUhM" does not exist in your test Stripe account.

To fix this issue:
1. Go to your Stripe Dashboard: https://dashboard.stripe.com/test/products
2. Create or locate your subscription products and copy the Price IDs
3. Update the following environment variables:
   - NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
   - NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID
   - NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
   - NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID

Currently configured monthly price ID: price_1SOxlkPoFQ98Rxs6M7QvtUhM

See docs/STRIPE_QUICK_START.md for detailed setup instructions.
```

**Production Mode:**

```
This subscription plan is not currently available. Please contact support for assistance.
```

### 3. Fallback Error Handling

Added a second layer of error handling around the actual Stripe API call (checkout session creation, subscription update) to catch any cases where the validation passes but the operation still fails.

### 4. HTTP Status Code Change

Changed the response status from **500 (Internal Server Error)** to **400 (Bad Request)** for price validation failures, since this is a configuration issue, not a server error.

## Files Modified

1. **`/src/app/api/stripe/create-checkout-session/route.ts`**
   - Added price validation before creating checkout session
   - Added enhanced error handling around checkout session creation
   - Imported `getStripeConfig` for test mode detection

2. **`/src/app/api/stripe/checkout/route.ts`**
   - Added price validation before creating checkout session
   - Added enhanced error handling around checkout session creation
   - Imported `getStripeConfig` for test mode detection

3. **`/src/app/api/stripe/change-plan/route.ts`**
   - Added price validation before updating subscription
   - Added enhanced error handling around subscription update
   - Imported `getStripeConfig` for test mode detection

## Benefits

1. **Better Developer Experience**: Clear, actionable error messages that guide developers to fix the issue
2. **Faster Debugging**: Exact price ID and mode information in error messages
3. **Reduced Support Burden**: Users get helpful guidance instead of vague errors
4. **Production Safety**: Production users get a generic message to contact support
5. **Correct HTTP Status**: 400 instead of 500 for configuration issues
6. **Proactive Validation**: Catches the issue early before Stripe operations fail

## Testing

To test the fix:

1. Set an invalid price ID in your environment:

   ```bash
   NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_invalid_test_id
   ```

2. Attempt to create a checkout session by selecting a plan on `/onboarding/plans`

3. Verify that you receive a 400 response with a detailed error message instead of a generic 500 error

4. Follow the instructions in the error message to configure valid price IDs

## Related Documentation

- `docs/STRIPE_QUICK_START.md` - Setup instructions for Stripe integration
- `docs/STRIPE_TEST_MODE_GUIDE.md` - Comprehensive testing guide
- `.env.example` - Example environment variable configuration
