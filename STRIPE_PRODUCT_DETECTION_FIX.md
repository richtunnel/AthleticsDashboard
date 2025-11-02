# Stripe Product Detection Fix

## Problem

When users clicked "Get Started" on a paid plan, the checkout flow would fail because the backend couldn't recognize the Stripe price IDs sent from the frontend. This was caused by a mismatch between frontend and backend environment variables.

### Root Cause

The frontend sends price IDs using public environment variables:
- `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`
- `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

But the backend only checked server-side environment variables:
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_ANNUAL_PRICE_ID`

If developers only set one set of variables (or if they didn't match), the backend would fail to recognize the price ID and either:
1. Return a validation error (if caught properly)
2. Redirect to login (if session/auth checks happened first)

## Solution

Updated the backend to support **both** server-side AND public environment variables, with server-side variables taking precedence when both are set.

### Files Modified

1. **`src/app/api/stripe/create-checkout-session/route.ts`**
   - Updated `priceIdToPlanTypeMap` to check both `STRIPE_*_PRICE_ID` and `NEXT_PUBLIC_STRIPE_*_PRICE_ID`
   - Backend now recognizes price IDs from either set of variables

2. **`src/app/api/stripe/checkout/route.ts`**
   - Updated price ID retrieval to check both sets of environment variables
   - Ensures consistency across different checkout endpoints

3. **`src/lib/stripe-config.ts`**
   - Updated `getStripeConfig()` to support both variable sets
   - Updated `validateStripeConfig()` to check for either set of variables
   - Improved validation messages to reflect the flexibility

4. **`docs/STRIPE_QUICK_START.md`**
   - Updated documentation to explain the flexible configuration
   - Clarified that developers can set either or both sets of variables

## Benefits

✅ **More Flexible Configuration**: Developers can now set either server-side variables, public variables, or both

✅ **Prevents Common Mistakes**: If developers only configure public variables (a common pattern), the checkout flow still works

✅ **Backwards Compatible**: Existing configurations with server-side variables continue to work

✅ **Prioritizes Server-Side**: When both are set, server-side variables take precedence (more secure)

✅ **Better Error Messages**: Validation now checks both sets and provides clearer guidance

## Environment Variable Priority

The fix uses this priority order:

```javascript
const monthlyPriceId = 
  process.env.STRIPE_MONTHLY_PRICE_ID ||           // 1. Server-side (highest priority)
  process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID  // 2. Public (fallback)
```

## Testing

To test the fix, you can configure your environment in any of these ways:

### Option 1: Public Variables Only (Now Supported!)
```env
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_1234567890
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_0987654321
```

### Option 2: Server-Side Variables Only
```env
STRIPE_MONTHLY_PRICE_ID=price_1234567890
STRIPE_ANNUAL_PRICE_ID=price_0987654321
```

### Option 3: Both (Redundant but Safe)
```env
STRIPE_MONTHLY_PRICE_ID=price_1234567890
STRIPE_ANNUAL_PRICE_ID=price_0987654321
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_1234567890
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_0987654321
```

All three configurations will now work correctly!

## Migration Guide

If you were experiencing this issue:

1. **No code changes needed** - The fix is in the backend
2. **Environment variables**: You can simplify your `.env.local` to only include ONE set of price ID variables if desired
3. **Recommended**: Keep both sets in sync for clarity (as shown in `.env.example`)

## Related Files

- `/src/app/onboarding/plans/page.tsx` - Frontend plans page (unchanged)
- `/src/app/api/stripe/create-checkout-session/route.ts` - Main checkout endpoint (fixed)
- `/src/app/api/stripe/checkout/route.ts` - Alternative checkout endpoint (fixed)
- `/src/lib/stripe-config.ts` - Stripe configuration utilities (fixed)
- `/.env.example` - Example environment configuration (reference)
- `/docs/STRIPE_QUICK_START.md` - Setup documentation (updated)
