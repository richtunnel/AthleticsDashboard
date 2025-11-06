# Stripe Test Mode Guide

This guide provides comprehensive instructions for testing the subscription checkout experience using Stripe's test mode.

## Table of Contents

1. [Setup](#setup)
2. [Test Mode Configuration](#test-mode-configuration)
3. [Testing Subscription Checkout](#testing-subscription-checkout)
4. [Testing Webhooks](#testing-webhooks)
5. [Test Cards](#test-cards)
6. [Test Scenarios](#test-scenarios)
7. [Troubleshooting](#troubleshooting)

## Setup

### Prerequisites

- Stripe account (test mode enabled by default for all new accounts)
- Stripe CLI installed for webhook testing
- Application running locally or in a test environment

### Installation

1. **Install Stripe CLI** (if not already installed):

   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Linux
   wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
   tar -xvf stripe_*_linux_x86_64.tar.gz
   sudo mv stripe /usr/local/bin

   # Windows (via Scoop)
   scoop install stripe
   ```

2. **Authenticate Stripe CLI**:

   ```bash
   stripe login
   ```

   This will open your browser to complete authentication.

3. **Verify installation**:
   ```bash
   stripe --version
   ```

## Test Mode Configuration

### Environment Variables

Ensure your `.env` or `.env.local` file has test mode keys:

```env
# Test mode keys (start with sk_test_ and whsec_)
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_from_stripe_cli
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_test_monthly_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_test_annual_id

# Optional: Override trial period in test mode (in days)
STRIPE_TEST_TRIAL_DAYS=1  # Set to 1 day for faster testing

# Public environment variables
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_test_monthly_id
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_test_annual_id
```

### Creating Test Products and Prices in Stripe

1. **Log in to Stripe Dashboard** (https://dashboard.stripe.com/test/products)
2. **Create a Product**:
   - Click "Add product"
   - Name: "Directors Plan"
   - Description: Optional
   - Click "Add pricing"

3. **Create Pricing**:
   - **Monthly Price**:
     - Pricing model: Standard pricing
     - Price: $40 USD
     - Billing period: Monthly
     - Click "Add price"
     - Copy the Price ID (starts with `price_`)
   - **Annual Price**:
     - Click "Add another price"
     - Price: $250 USD
     - Billing period: Yearly
     - Click "Add price"
     - Copy the Price ID

4. **Update your environment variables** with the copied Price IDs

## Testing Subscription Checkout

### Test Mode Features

The application includes several test-mode-specific features:

1. **Automatic Test Mode Detection**: The application automatically detects when using test keys
2. **Enhanced Logging**: Test mode enables detailed console logging of all Stripe operations
3. **Test Metadata**: All Stripe objects created in test mode include test-specific metadata
4. **Promotion Codes Enabled**: Test mode allows using promotion codes in checkout
5. **Configurable Trial Period**: Override default trial period for faster testing

### Basic Checkout Flow Test

1. **Start the application**:

   ```bash
   yarn dev
   ```

2. **Navigate to the plans page**: `http://localhost:3000/onboarding/plans`

3. **Select a plan** (Monthly or Annual)

4. **Click "Get started"**:
   - You'll be redirected to Stripe Checkout
   - Notice the test mode indicator in Stripe's UI

5. **Fill in test payment details**:
   - Email: Any valid email
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - Name: Any name
   - Country: Any country

6. **Complete the checkout**:
   - Click "Subscribe"
   - You'll be redirected back to your success URL

7. **Verify in console logs**: Look for test mode log entries like:
   ```
   [Stripe Test Mode] Creating checkout session {
     userId: "...",
     planType: "MONTHLY",
     trialEligible: true,
     ...
   }
   ```

## Testing Webhooks

Webhooks are critical for subscription lifecycle management. Test them locally using the Stripe CLI.

### Setup Local Webhook Forwarding

1. **Start webhook forwarding**:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

2. **Copy the webhook signing secret**: The CLI will output a webhook secret like `whsec_...` Update your `.env` file:

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```

3. **Restart your application** to pick up the new webhook secret

### Testing Webhook Events

#### Test Checkout Completion

```bash
# Complete a checkout session in the UI first, or trigger manually:
stripe trigger checkout.session.completed
```

Expected behavior:

- Console shows: `[Stripe Test Mode] Webhook received`
- Subscription status changes to `TRIALING` or `ACTIVE`
- User receives confirmation email
- Database updated with subscription details

#### Test Subscription Updates

```bash
stripe trigger customer.subscription.updated
```

#### Test Payment Failures

```bash
stripe trigger invoice.payment_failed
```

Expected behavior:

- User receives payment failure email
- Subscription status changes to `PAST_DUE`

#### Test Cancellations

```bash
# Get your subscription ID from the database or Stripe dashboard
stripe subscriptions cancel sub_xxxxxxxxxxxxx
```

Or trigger a test event:

```bash
stripe trigger customer.subscription.deleted
```

Expected behavior:

- Subscription status changes to `CANCELED`
- User receives cancellation email
- Grace period scheduled if applicable

### Viewing Webhook Logs

1. **In Stripe CLI**: The CLI shows real-time webhook requests and responses

2. **In Stripe Dashboard**:
   - Navigate to Developers > Webhooks
   - Click on your endpoint
   - View event history and response codes

3. **In Application Logs**: Look for test mode webhook logs:
   ```
   [Stripe Test Mode] Webhook received {
     eventType: "customer.subscription.updated",
     eventId: "evt_...",
     livemode: false
   }
   ```

## Test Cards

### Successful Payments

| Card Number        | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `4242424242424242` | Visa - succeeds and immediately processes the payment |
| `4000056655665556` | Visa (debit) - succeeds and processes as debit        |
| `5555555555554444` | Mastercard - succeeds and immediately processes       |
| `378282246310005`  | American Express - succeeds                           |

### Card Requiring Authentication (3D Secure)

| Card Number        | Description                                       |
| ------------------ | ------------------------------------------------- |
| `4000002500003155` | Requires authentication - triggers 3D Secure flow |
| `4000002760003184` | Requires authentication (Brazil)                  |

### Failed Payments

| Card Number        | Error Code           | Description        |
| ------------------ | -------------------- | ------------------ |
| `4000000000000002` | `card_declined`      | Generic decline    |
| `4000000000009995` | `insufficient_funds` | Insufficient funds |
| `4000000000009987` | `lost_card`          | Lost card          |
| `4000000000009979` | `stolen_card`        | Stolen card        |
| `4000000000000069` | `expired_card`       | Expired card       |
| `4000000000000127` | `incorrect_cvc`      | Incorrect CVC      |
| `4000000000000119` | `processing_error`   | Processing error   |

### Testing International Cards

| Card Number        | Country        | Description   |
| ------------------ | -------------- | ------------- |
| `4000000400000008` | United States  | US Visa       |
| `4000002080000001` | Canada         | Canadian Visa |
| `4000000560000004` | Germany        | German Visa   |
| `4000003920000003` | United Kingdom | UK Visa       |

For all cards:

- **Expiry**: Any future date (MM/YY format)
- **CVC**: Any 3 digits (4 for Amex)
- **ZIP**: Any valid ZIP code for the selected country

## Test Scenarios

### Scenario 1: New User with Trial

**Objective**: Test first-time subscription with 14-day trial

**Steps**:

1. Create new user account or use existing user without subscription
2. Go to plans page
3. Select Monthly or Annual plan
4. Complete checkout with test card `4242424242424242`
5. **Verify**:
   - Subscription status: `TRIALING`
   - `hasReceivedFreeTrial`: `true`
   - `trialEnd`: 14 days from now (or configured test days)
   - Confirmation email sent

### Scenario 2: Existing User (No Trial)

**Objective**: Test subscription without trial for returning user

**Steps**:

1. Use user who already had a trial (`hasReceivedFreeTrial: true`)
2. Go to plans page
3. Complete checkout
4. **Verify**:
   - Subscription status: `ACTIVE` (not TRIALING)
   - No trial dates set
   - Payment charged immediately

### Scenario 3: Payment Failure

**Objective**: Test payment failure handling

**Steps**:

1. Start checkout
2. Use card `4000000000000002` (generic decline)
3. **Verify**:
   - Payment fails
   - Error message shown to user
   - No subscription created

### Scenario 4: 3D Secure Authentication

**Objective**: Test Strong Customer Authentication (SCA)

**Steps**:

1. Start checkout
2. Use card `4000002500003155`
3. Complete the 3D Secure challenge (in test mode, just click "Complete")
4. **Verify**:
   - Authentication succeeds
   - Subscription created
   - Payment processed

### Scenario 5: Cancel Subscription

**Objective**: Test cancellation flow

**Steps**:

1. Create active subscription
2. Navigate to Settings page
3. Click "Cancel Subscription"
4. Choose cancellation timing (end of period vs. immediate)
5. **Verify**:
   - If end of period: `cancelAt` date set, status remains `ACTIVE`
   - If immediate: status changes to `CANCELED`
   - Cancellation email sent
   - Grace period calculated

### Scenario 6: Change Plan

**Objective**: Test plan switching (Monthly ↔ Annual)

**Steps**:

1. Create active subscription (e.g., Monthly)
2. Go to Settings
3. Click "Change Plan" and select Annual
4. **Verify**:
   - Plan changes immediately
   - Proration applied
   - Subscription updated in database
   - User charged/credited difference

### Scenario 7: Webhook Retry

**Objective**: Test webhook idempotency

**Steps**:

1. Complete a checkout session
2. Note the webhook event ID
3. Resend the same webhook:
   ```bash
   stripe events resend evt_xxxxxxxxxxxxx
   ```
4. **Verify**:
   - Webhook returns 200 OK
   - No duplicate database entries
   - No duplicate emails sent

### Scenario 8: Fast Trial Testing

**Objective**: Test trial expiration quickly

**Steps**:

1. Set `STRIPE_TEST_TRIAL_DAYS=0` in `.env` (for immediate expiration testing) Or use Stripe Test Clocks (see below)
2. Create subscription with trial
3. **Verify**:
   - Trial period shortened
   - Can test trial-end behavior faster

## Using Stripe Test Clocks

Stripe Test Clocks allow you to simulate time passing for testing time-based features like trials.

### Create a Test Clock

```bash
# Create a test clock
stripe test_helpers test_clocks create --name "Fast Trial Test"

# Create a customer with the test clock
stripe customers create \
  --email="test@example.com" \
  --test_clock="clock_xxxxxxxxxxxxx"
```

### Advance Time

```bash
# Advance the test clock by 14 days
stripe test_helpers test_clocks advance clock_xxxxxxxxxxxxx \
  --frozen_time=$(date -v+14d +%s)
```

This will trigger trial-ending webhooks and allow testing subscription transitions.

## Troubleshooting

### Issue: Webhook Secret Invalid

**Symptoms**: Webhook returns 400 error, signature verification fails

**Solution**:

1. Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen`
2. Restart your application after updating the secret
3. Check that the webhook endpoint is accessible: `curl http://localhost:3000/api/stripe/webhook`

### Issue: Test Mode Not Detected

**Symptoms**: No test mode logs appearing

**Solution**:

1. Verify `STRIPE_SECRET_KEY` starts with `sk_test_`
2. Check that stripe-config is imported correctly
3. Ensure `NODE_ENV` is not set to `production`

### Issue: Checkout Session Fails

**Symptoms**: Error when creating checkout session

**Solution**:

1. Verify price IDs exist in test mode Stripe dashboard
2. Check that price IDs in environment variables match Stripe
3. Ensure prices are active (not archived)
4. Check console for detailed error messages

### Issue: No Emails Received

**Symptoms**: Webhooks process but no emails sent

**Solution**:

1. Check `NEXT_PUBLIC_RESEND_API_KEY` is configured
2. Verify email service is not in test mode
3. Check Resend dashboard for email logs
4. In test mode, emails might be sent to a test inbox

### Issue: Database Not Updating

**Symptoms**: Checkout completes but subscription not in database

**Solution**:

1. Check webhook is running (`stripe listen` active)
2. Verify webhook secret is correct
3. Check application logs for webhook errors
4. Ensure database connection is healthy
5. Check that webhook handler completed successfully (200 response)

### Issue: Idempotency Problems

**Symptoms**: Duplicate charges or subscriptions

**Solution**:

1. Verify idempotency keys are being used in API calls
2. Check that webhook duplicate detection is working
3. Clear any pending checkout sessions in Stripe dashboard

## Best Practices

1. **Use Test Mode Exclusively for Development**:
   - Never mix test and production data
   - Keep test and production API keys separate
   - Use environment-specific .env files

2. **Test All Scenarios**:
   - Use the test scenarios checklist above
   - Test error cases as thoroughly as success cases
   - Verify webhook handling for all subscription events

3. **Monitor Test Mode Logs**:
   - Watch console for `[Stripe Test Mode]` logs
   - Check Stripe dashboard for test transactions
   - Review webhook event logs regularly

4. **Clean Up Test Data**:
   - Periodically clean test subscriptions from database
   - Archive old test customers in Stripe
   - Clear test checkout sessions

5. **Document Test Results**:
   - Keep track of what scenarios have been tested
   - Note any bugs or issues discovered
   - Share test results with team

6. **Use Meaningful Test Data**:
   - Use descriptive names and emails for test customers
   - Add metadata to identify test vs. real attempts
   - Keep test data organized

## Additional Resources

- [Stripe Testing Docs](https://stripe.com/docs/testing)
- [Stripe CLI Reference](https://stripe.com/docs/cli)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe Test Clocks](https://stripe.com/docs/billing/testing/test-clocks)

## Support

For issues with Stripe integration:

1. Check application logs for detailed error messages
2. Review Stripe dashboard event logs
3. Consult Stripe documentation
4. Contact team lead or Stripe support if needed
