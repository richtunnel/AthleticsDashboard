# Bug Fix: Onboarding Plans Checkout Issue

## Problem Description
Users clicking "Get Started" on `/onboarding/plans` were experiencing issues:
1. Redirected to login page unexpectedly
2. Error: "Unable to create billing profile. Please try again or contact support."

## Root Cause

When users initiate a checkout session but don't complete payment:
1. Stripe creates a checkout session (valid for 24 hours by default)
2. Database creates subscription with status `INCOMPLETE`
3. User doesn't complete payment within 24 hours
4. Stripe marks subscription as `incomplete_expired`
5. Stripe webhook may be delayed or not fire
6. Database still shows `INCOMPLETE` or `INCOMPLETE_EXPIRED`
7. When user tries again, system fails to:
   - Check actual subscription status in Stripe
   - Allow retry if subscription is expired/canceled
   - Provide helpful error messages

## Changes Made

### 1. `/src/app/api/stripe/create-checkout-session/route.ts`

**Added robust handling for existing subscriptions:**
- Check if user has an existing `stripeSubscriptionId` before creating customer
- Retrieve actual subscription status from Stripe (not just database)
- Allow new checkout attempts if:
  - Subscription is `incomplete` or `incomplete_expired` in Stripe
  - Subscription is `canceled` or `past_due` in Stripe
- Block new checkout if subscription is `active` or `trialing` in Stripe
- Comprehensive logging for debugging subscription status mismatches

**Key improvement:**
```typescript
// Check for existing incomplete/expired subscriptions in Stripe
if (user.subscription && user.subscription.stripeSubscriptionId) {
  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(user.subscription.stripeSubscriptionId);
    const stripeStatus = stripeSubscription.status;

    // Allow retry for incomplete, expired, canceled, or past_due
    if (stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired' ||
        stripeStatus === 'canceled' || stripeStatus === 'past_due') {
      console.log(`[Checkout] Allowing new checkout for user with ${stripeStatus} subscription`);
    }
    // Block for active or trialing
    else if (stripeStatus === 'active' || stripeStatus === 'trialing') {
      return NextResponse.json({ error: "You already have an active subscription..." }, { status: 400 });
    }
  } catch (err) {
    // If subscription doesn't exist, allow proceeding
    if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
      console.log(`[Checkout] Stripe subscription not found, allowing new checkout`);
    }
  }
}
```

### 2. `/src/app/onboarding/plans/page.tsx`

**Added incomplete subscription awareness:**
- New state: `hasIncompleteSubscription` checks for `INCOMPLETE` or `INCOMPLETE_EXPIRED`
- Shows info alert when user has incomplete subscription
- User guidance: "You can select a plan below to complete your subscription. If you're experiencing issues, please contact support."

**Enhanced user experience:**
- Users understand they can retry with incomplete subscription
- Clear guidance on next steps
- Reduces confusion about why "Get Started" failed before

## Key Improvements

1. **Prevents blocking retry attempts**: Users can retry checkout with incomplete/expired/canceled subscriptions
2. **Handles Stripe-Da tabase sync issues**: Checks actual Stripe status, not just database
3. **Better debugging**: Comprehensive logging for subscription status comparisons
4. **User-friendly UX**: Clear messages guide users on what to do
5. **Graceful error handling**: Continues even if webhook hasn't updated database yet

## Scenarios Handled

1. **Incomplete subscription (< 24 hours)**: Allows retry, creates new checkout session
2. **Expired incomplete subscription (> 24 hours)**: Allows retry, creates new checkout session
3. **Canceled subscription**: Allows retry, creates new checkout session
4. **Past due subscription**: Allows retry, creates new checkout session
5. **Active/Trial subscription**: Blocks new checkout with clear message
6. **Subscription not in Stripe**: Allows retry (subscription may have been deleted)
7. **Webhook delay**: Works correctly even if database hasn't been updated yet

## Testing Recommendations

1. Test flow where user initiates checkout but doesn't complete payment
2. Wait for >24 hours (or manually expire in Stripe test mode)
3. Verify webhook updates subscription to `INCOMPLETE_EXPIRED`
4. Try clicking "Get Started" again - should work without errors
5. Test with webhook disabled (simulating delay) - should still work
6. Verify logging shows Stripe vs database status comparisons

## Technical Details

- **Stripe checkout session expiration**: 24 hours (default Stripe behavior)
- **User session**: 30 days (unrelated to checkout flow)
- **The fix**: Check actual Stripe subscription status when user tries again
- **No need to change user session**: 30-day session is appropriate for onboarding

## Why Not Changing User Session to 24 Hours

Changing user session from 30 days to 24 hours would:
- Force users to re-authenticate during onboarding if they take >24h
- Break the flow when they return to complete payment
- Not solve the Stripe checkout expiration issue

The real fix is handling Stripe subscription states, not user session duration.
