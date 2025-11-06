# Stripe Webhook Manual Test Plan

This checklist documents the steps required to manually validate the enhanced Stripe webhook handler, database syncing, and lifecycle emails.

## Prerequisites

- Stripe CLI installed locally and authenticated (`stripe login`).
- The application running locally (`yarn dev`) with the following environment variables configured:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_RESEND_API_KEY`
  - `NEXTAUTH_URL` (used for portal links in emails)
- PostgreSQL database migrated with the latest Prisma schema (`yarn prisma migrate deploy`).
- Access to the database (e.g., `psql` or Prisma Studio) to inspect `Subscription`, `User`, and `StripeWebhookEvent` tables.

## General Verification

1. Start the Stripe CLI webhook relay:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
2. Open a database inspector and note the relevant `User` record (email, `subscriptionId`, `subscriptionStatus`, `hasReceivedFreeTrial`).
3. After each simulated event:
   - Confirm the webhook endpoint returns HTTP 200 in the Stripe CLI output.
   - Inspect `StripeWebhookEvent` to ensure the event `id` is recorded (verifying dedupe logic).
   - Verify the `Subscription` table reflects the Stripe payload (status, period dates, `cancelAt`, plan identifiers).
   - Verify the associated `User` record (`subscriptionStatus`, `cancellationDate`, `deletionScheduledAt`, `hasReceivedFreeTrial`, and `plan`).
   - Check the email inbox/log (Resend dashboard) for the expected message.

## Event Scenarios

### 1. Checkout Session Completion

- Create a checkout session in test mode and complete it via the Stripe-hosted page.
- Expectation:
  - `Subscription.status` is `trialing` or `active` with appropriate period dates.
  - `User.subscriptionStatus` aligns with Stripe, `trialEnd` stored, `hasReceivedFreeTrial` becomes `true`.
  - Confirmation email "Your … subscription is confirmed" is delivered.

### 2. Subscription Created / Activated

- Trigger `customer.subscription.created` (e.g., via Stripe dashboard or CLI):
  ```bash
  stripe trigger customer.subscription.created
  ```
- Expectation: same as checkout completion if the subscription transitioned into `active`/`trialing`; confirmation email fires once.

### 3. Subscription Updated (Plan Change)

- Change the subscription plan in the Stripe dashboard.
- Expectation:
  - `Subscription.planPriceId`, `planLookupKey`, and `planNickname` update.
  - `User.plan` reflects the new plan identifier.
  - No duplicate confirmation email unless status transitioned from non-active to active.

### 4. Cancellation Scheduled (cancel at period end)

- Schedule a cancellation:
  ```bash
  stripe subscriptions update <sub_id> --cancel-at-period-end true
  ```
- Expectation:
  - `Subscription.cancelAt` populated.
  - `User.deletionScheduledAt` updated, `subscriptionStatus` remains `active`.
  - Cancellation email with grace-period messaging delivered once.

### 5. Immediate Cancellation / Deletion

- Cancel immediately:
  ```bash
  stripe subscriptions cancel <sub_id>
  ```
- Expectation:
  - `Subscription.status` becomes `canceled`, `canceledAt` populated.
  - `User.subscriptionStatus` updates to `canceled`, `plan` downgraded to `free`.
  - Cancellation confirmation email delivered.

### 6. Payment Failure

- Simulate payment failure:
  ```bash
  stripe trigger invoice.payment_failed
  ```
- Expectation:
  - `Subscription.status` moves to `past_due` (or similar) while retaining plan info.
  - `StripeWebhookEvent` logged.
  - Payment failure email sent with portal link, due date (if provided), and invoice URL.

### 7. Trial Ending Reminder

- Trigger the trial-ending event:
  ```bash
  stripe trigger customer.subscription.trial_will_end
  ```
- Expectation:
  - `Subscription.trialEnd` present in DB.
  - Trial reminder email delivered referencing the upcoming date.

## Duplicate Event Guard

- Re-deliver any prior event using the Stripe CLI (e.g., copy the event `id` and call `stripe events resend <id>`).
- Expectation: webhook returns 200 but skips processing; no duplicate DB updates or emails occur, and log output shows "duplicate" handling.

## Error Handling Smoke Test

- Temporarily change `STRIPE_WEBHOOK_SECRET` locally to an invalid value and resend an event.
- Expectation: endpoint responds with HTTP 400 and logs `stripe.webhook.signature_verification_failed`; no DB changes occur.

Document the results of each scenario (timestamps, DB snapshots, email previews) to accompany QA sign-off.
