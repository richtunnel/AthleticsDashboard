# Stripe Configuration Fix

## Problem

Users were encountering the error message:

```
This plan is currently unavailable.
Please contact support
```

This error occurred when Stripe price IDs were not properly configured in the environment variables.

## Root Cause

The application requires two environment variables to enable subscription checkout:

- `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

These variables were either:

1. Not set at all
2. Set to placeholder values (e.g., `price_your_monthly_price_id`)
3. Not properly loaded by the application

## Solution Implemented

### 1. Enhanced Validation (`src/lib/stripe-config.ts`)

Added validation functions to detect invalid price IDs:

- `isValidPriceId()`: Checks if a price ID is valid (not empty, not a placeholder, starts with `price_`)
- `validateClientStripeConfig()`: Client-side validation for NEXT_PUBLIC variables
- Enhanced `validateStripeConfig()`: Now detects both missing and invalid (placeholder) values

### 2. Improved User Experience (`src/app/onboarding/plans/page.tsx`)

**Development Mode:**

- Shows a clear configuration banner when price IDs are missing/invalid
- Provides specific instructions on which environment variables to set
- References the setup documentation (`docs/STRIPE_QUICK_START.md`)
- Displays helpful error messages that indicate exactly what's misconfigured

**Production Mode:**

- Maintains the generic "contact support" message to avoid exposing configuration details

### 3. Better Error Messages (`src/app/api/stripe/create-checkout-session/route.ts`)

Enhanced the checkout session creation endpoint to:

- Detect invalid price IDs server-side
- Return detailed error messages in development
- Maintain security by keeping generic messages in production

## How It Works

### Client-Side Validation Flow

1. On page load, `isPriceConfigured()` checks if both monthly and annual price IDs are valid
2. If invalid in development mode:
   - A red configuration banner is displayed at the top
   - Plan cards show "Price ID not configured" instead of "Currently unavailable"
   - Clicking "Get started" shows a detailed error message
3. If invalid in production mode:
   - Generic "contact support" messages are shown
   - No configuration details are exposed

### Validation Criteria

A price ID is considered **valid** if it:

- Is not empty
- Does not contain placeholder text (`your_monthly_price_id`, `your_annual_price_id`)
- Starts with `price_` (Stripe's price ID prefix)
- Is longer than 10 characters

### Example Valid Price IDs

```
price_1QLhDEKlABCDEFGHIJKLMNOP  ✓
price_1234567890abc             ✓
```

### Example Invalid Price IDs

```
                                ✗ (empty)
price_your_monthly_price_id     ✗ (placeholder)
invalid_1234567890              ✗ (wrong prefix)
price_123                       ✗ (too short)
```

## Setup Instructions

To fix the "plan unavailable" error, follow these steps:

### 1. Create Stripe Products and Prices

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Click "Add product"
3. Create a product with two prices:
   - **Monthly**: $40/month
   - **Annual**: $250/year
4. Copy each Price ID (starts with `price_`)

### 2. Configure Environment Variables

Create or update `.env.local` in the project root:

```env
# Stripe Price IDs
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_your_actual_monthly_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_your_actual_annual_id

# Also set server-side variables
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_your_actual_monthly_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_your_actual_annual_id
```

### 3. Restart the Application

```bash
# The app needs to be restarted to pick up the new environment variables
npm run dev
# or
yarn dev
```

### 4. Verify Configuration

1. Navigate to `/onboarding/plans`
2. In development mode, you should **not** see the red configuration banner
3. Plans should show the "Get started" button without error messages
4. Clicking "Get started" should redirect to Stripe Checkout

## Testing

### Test the Validation Logic

The validation functions can be tested independently:

```javascript
import { isValidPriceId } from "@/lib/stripe-config";

// Should return false
isValidPriceId("");
isValidPriceId("price_your_monthly_price_id");
isValidPriceId("invalid_prefix");

// Should return true
isValidPriceId("price_1QLhDEKlABCDEFGHIJKLMNOP");
```

### Test the User Experience

1. **With missing config (development):**
   - Remove or comment out `NEXT_PUBLIC_STRIPE_*` variables
   - Visit `/onboarding/plans`
   - Should see red configuration banner
   - Plans should be disabled with helpful messages

2. **With valid config:**
   - Set proper price IDs
   - Visit `/onboarding/plans`
   - Should see plans enabled
   - Clicking "Get started" should work

3. **In production mode:**
   - Set `NODE_ENV=production`
   - With missing config, should see generic "contact support" message
   - No configuration details should be visible

## Files Modified

1. `src/app/onboarding/plans/page.tsx`
   - Added validation functions
   - Added configuration banner
   - Enhanced error messages

2. `src/lib/stripe-config.ts`
   - Added `isValidPriceId()` function
   - Enhanced `validateStripeConfig()` to detect placeholder values
   - Added `validateClientStripeConfig()` for client-side validation

3. `src/app/api/stripe/create-checkout-session/route.ts`
   - Enhanced error messages for invalid price IDs
   - Different messages for development vs production

## Migration Guide

No database migrations or breaking changes. This is purely a UX and validation improvement.

Existing users with properly configured Stripe price IDs will see no changes.

## Future Improvements

1. Add a setup wizard for first-time Stripe configuration
2. Add server-side API endpoint to verify Stripe configuration
3. Add automated tests for validation logic
4. Consider environment-specific defaults for faster local development

## Related Documentation

- [STRIPE_QUICK_START.md](./docs/STRIPE_QUICK_START.md) - 5-minute setup guide
- [STRIPE_TEST_MODE_GUIDE.md](./docs/STRIPE_TEST_MODE_GUIDE.md) - Comprehensive testing guide
