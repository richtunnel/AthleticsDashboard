# Bug Fix: Onboarding Plans Checkout Issue

## Problem Description
Users clicking "Get Started" on `/onboarding/plans` were experiencing issues:
1. Redirected to login page unexpectedly
2. Error: "Unable to create billing profile. Please try again or contact support."

## Root Cause
The issue occurred when:
1. A user initiated checkout (creating a Stripe checkout session, which expires after 24 hours)
2. User didn't complete payment within 24 hours
3. Stripe marked the subscription as `incomplete_expired`
4. If webhook didn't fire or delayed, database still showed `INCOMPLETE`
5. When user tried again, the system didn't properly handle the existing incomplete/expired subscription

## Changes Made

### 1. `/src/app/api/stripe/create-checkout-session/route.ts`

**Added check for existing incomplete/expired subscriptions:**
- Before creating a new checkout session, check if user has existing `INCOMPLETE` or `INCOMPLETE_EXPIRED` subscription
- Verify actual status in Stripe (not just database)
- Allow retrying checkout if subscription is expired or doesn't exist in Stripe
- Better logging to track subscription status comparisons

**Improved error handling:**
- More detailed error logging for Stripe customer creation failures (includes userId, email, error details)
- Enhanced error messages for subscription-related checkout errors
- Development mode shows detailed error with context about 24-hour checkout session expiration
- Production mode shows user-friendly message

### 2. `/src/app/onboarding/plans/page.tsx`

**Added incomplete subscription awareness:**
- New state variable: `hasIncompleteSubscription`
- Shows info alert when user has incomplete subscription
- Better user guidance: "You can select a plan below to complete your subscription"

**Enhanced logging:**
- Added console log when redirecting to login with callbackUrl

### 3. `/src/lib/services/payment-status.service.ts`

**Updated to allow dashboard access for incomplete subscriptions:**
- Users with `INCOMPLETE_EXPIRED` status can access dashboard
- They need access to try again or contact support
- Only locks dashboard for `PAST_DUE` or `UNPAID` (after 48-hour grace period)

### 4. `/src/app/api/stripe/webhook/route.ts`

**Enhanced status mapping logging:**
- Added console logs when mapping Stripe status to database status
- Helps debug webhook processing issues
- Logs unknown statuses as warnings

## Key Improvements

1. **Prevents blocking of retry attempts**: Users can now retry checkout even with incomplete/expired subscriptions
2. **Better debugging**: Comprehensive logging helps identify where issues occur
3. **User-friendly errors**: Clear messages guide users on what to do
4. **Dashboard access**: Incomplete subscriptions don't lock dashboard access
5. **Proactive alerts**: Plans page shows info when user has incomplete subscription

## Testing Recommendations

1. Test flow where user initiates checkout but doesn't complete payment
2. Wait for >24 hours (or manually expire in Stripe test mode)
3. Try clicking "Get Started" again - should work without errors
4. Verify webhook properly updates subscription status to `INCOMPLETE_EXPIRED`
5. Test with both scenarios:
   - Webhook fires correctly
   - Webhook doesn't fire (manual retry should still work)

## Stripe Checkout Session Expiration

By default, Stripe checkout sessions expire after 24 hours. After expiration:
- Subscription status becomes `incomplete_expired`
- User can still retry checkout (our changes support this)
- New checkout session creates a fresh subscription attempt
