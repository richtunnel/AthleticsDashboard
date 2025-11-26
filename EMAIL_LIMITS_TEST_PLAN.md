# Email Limits Feature - Test Plan

## Overview
This test plan covers the email sending limits feature implementation:
- Per-user daily limit: 75 emails per 24 hours
- System-wide monthly limit: 100,000 emails per calendar month

## Pre-Test Setup

### 1. Verify Installation
```bash
# Check files exist
ls -la src/lib/services/email-limit.service.ts
ls -la src/app/api/email/limits/route.ts
ls -la src/components/settings/EmailLimitsCard.tsx

# Check integrations
grep "emailLimitService" src/lib/services/email.service.ts
grep "emailLimitService" src/lib/utils/bulk-email.ts
grep "EmailLimitsCard" src/app/dashboard/settings/page.tsx
```

### 2. Database Check
```sql
-- Verify EmailLog table exists with required fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'EmailLog' 
AND column_name IN ('sentById', 'sentAt', 'status');

-- Check for existing email logs
SELECT COUNT(*) FROM "EmailLog";
```

## Test Cases

### Test 1: View Email Usage Stats (UI)

**Objective**: Verify the Email Usage card displays correctly in Settings

**Steps**:
1. Log in to the application
2. Navigate to `/dashboard/settings`
3. Scroll to the "Email Usage" card

**Expected Results**:
- ✅ Card displays with title "Email Usage"
- ✅ Info icon with tooltip visible
- ✅ Two progress bars shown:
  - Daily Limit (Your Account): X / 75
  - Monthly Limit (System-wide): X / 100,000
- ✅ Remaining email counts displayed below each bar
- ✅ Progress bars color-coded appropriately:
  - Green if usage < 75%
  - Yellow if usage 75-89%
  - Red if usage ≥ 90%

### Test 2: Email Usage API Endpoint

**Objective**: Verify the API returns correct usage statistics

**Steps**:
1. Open browser DevTools (Network tab)
2. Navigate to `/dashboard/settings`
3. Look for request to `/api/email/limits`
4. Inspect response

**Expected Results**:
```json
{
  "success": true,
  "data": {
    "daily": {
      "used": <number>,
      "limit": 75,
      "remaining": <75 - used>,
      "percentage": <calculated>
    },
    "monthly": {
      "used": <number>,
      "limit": 100000,
      "remaining": <100000 - used>,
      "percentage": <calculated>
    }
  }
}
```

### Test 3: Send Email Within Limits

**Objective**: Verify emails send successfully when within limits

**Steps**:
1. Navigate to `/dashboard/games`
2. Select 1-3 games
3. Click "Send Email" button
4. Fill in recipient email addresses (your test email)
5. Add subject and message
6. Click "Send"
7. Return to Settings page
8. Check Email Usage card

**Expected Results**:
- ✅ Email sends successfully
- ✅ Success notification appears
- ✅ Daily usage counter increments by number of recipients
- ✅ Monthly usage counter increments by number of recipients
- ✅ Progress bars update accordingly

### Test 4: Daily Limit Enforcement

**Objective**: Verify the system prevents sending when daily limit is reached

**Pre-requisite**: User must have sent 75+ emails in the last 24 hours

**Option A - Simulate via Database**:
```sql
-- Create 75 test email logs for current user
INSERT INTO "EmailLog" (id, "to", cc, subject, body, status, "sentAt", "sentById", "gameIds", "createdAt")
SELECT 
  gen_random_uuid(),
  ARRAY['test@example.com'],
  ARRAY[]::text[],
  'Test Email ' || generate_series,
  'Test body',
  'SENT',
  NOW() - interval '1 hour' * (75 - generate_series),
  'YOUR_USER_ID',
  ARRAY[]::text[],
  NOW()
FROM generate_series(1, 75);
```

**Option B - Send Real Emails** (if testing environment allows):
1. Create a script to send 75 test emails
2. Wait for all to complete

**Test Steps**:
1. Verify usage shows 75/75 on Settings page
2. Try to send one more email via Games table
3. Observe the result

**Expected Results**:
- ✅ Email send fails
- ✅ Error message displays:
  ```
  Daily email limit exceeded. You have sent 75 of 75 emails today. Please try again tomorrow.
  ```
- ✅ No email is sent
- ✅ Usage counter remains at 75

### Test 5: Daily Limit Partial Availability

**Objective**: Verify correct remaining count when approaching limit

**Pre-requisite**: User has sent 70 emails in last 24 hours

**Steps**:
1. Navigate to Settings page
2. Check daily usage (should show 70/75)
3. Try to send 10 emails (more than 5 remaining)

**Expected Results**:
- ✅ Settings shows "5 emails remaining today"
- ✅ Attempt to send 10 fails with error:
  ```
  Daily email limit exceeded. You have sent 70 of 75 emails today. You can send 5 more emails.
  ```
- ✅ Successfully send 5 emails
- ✅ After sending 5, further sends fail

### Test 6: Monthly Limit Enforcement

**Objective**: Verify system-wide monthly limit is enforced

**Note**: This is difficult to test in production. Best tested in isolated test environment.

**Simulation via Database**:
```sql
-- Create 100,000 test email logs system-wide (distributed across users)
-- WARNING: Only do this in test environment!
INSERT INTO "EmailLog" (id, "to", cc, subject, body, status, "sentAt", "sentById", "gameIds", "createdAt")
SELECT 
  gen_random_uuid(),
  ARRAY['test@example.com'],
  ARRAY[]::text[],
  'Test Email ' || generate_series,
  'Test body',
  'SENT',
  DATE_TRUNC('month', CURRENT_DATE) + interval '1 day' * (generate_series % 28),
  (SELECT id FROM "User" ORDER BY RANDOM() LIMIT 1),
  ARRAY[]::text[],
  NOW()
FROM generate_series(1, 100000);
```

**Test Steps**:
1. Verify monthly usage shows 100,000/100,000
2. Try to send any email
3. Observe the result

**Expected Results**:
- ✅ Email send fails
- ✅ Error message displays:
  ```
  System-wide monthly email limit reached. 100,000 of 100,000 emails sent this month. Limit will reset at the start of next month.
  ```
- ✅ No email is sent

### Test 7: System Emails Exempt from Limits

**Objective**: Verify system emails (no sentById) bypass limits

**Steps**:
1. Trigger a password reset request
2. OR trigger a welcome email (create new account)
3. Verify email sends even if user is at limit

**Expected Results**:
- ✅ System email sends successfully
- ✅ Usage counters do NOT increment
- ✅ System emails work even when user is at 75/75 limit

### Test 8: Rolling 24-Hour Window

**Objective**: Verify daily limit uses rolling 24-hour window

**Setup**: Send 75 emails at 9:00 AM on Day 1

**Test Timeline**:
- Day 1, 9:00 AM: Send 75 emails → At limit
- Day 1, 10:00 AM: Try to send → Should fail
- Day 2, 8:59 AM: Try to send → Should fail (still within 24h)
- Day 2, 9:01 AM: Try to send → Should succeed (25h have passed)

**Expected Results**:
- ✅ Limit enforces for full 24 hours from first email
- ✅ Limit becomes available after 24 hours

### Test 9: Calendar Month Reset

**Objective**: Verify monthly limit resets on 1st of month

**Setup**: Send emails near end of month

**Test Timeline**:
- Month 1, Day 31: Check monthly usage (e.g., 5,000/100,000)
- Month 2, Day 1: Check monthly usage

**Expected Results**:
- ✅ Usage counter resets to 0 on the 1st
- ✅ Historical data still exists in EmailLog table
- ✅ Can send emails immediately on the 1st

### Test 10: Failed Emails Don't Count

**Objective**: Verify failed emails don't count toward limits

**Steps**:
1. Note current usage (e.g., 10/75)
2. Attempt to send email with invalid configuration (to force failure)
3. Check usage after failed send

**Expected Results**:
- ✅ Email fails to send
- ✅ EmailLog entry created with status='FAILED'
- ✅ Usage counter remains the same (10/75)
- ✅ Only successfully sent emails count

### Test 11: Bulk Email Limit Check

**Objective**: Verify bulk emails check limits before sending batch

**Steps**:
1. User has 70/75 emails used
2. Try to send bulk email to 10 recipients
3. Observe result

**Expected Results**:
- ✅ Bulk send fails immediately
- ✅ Error message explains: "...You can send 5 more emails."
- ✅ NO emails are sent (all-or-nothing)
- ✅ Usage remains at 70/75

### Test 12: Auto-Refresh UI

**Objective**: Verify UI updates automatically

**Steps**:
1. Open Settings page
2. Note current usage (e.g., 10/75)
3. In another tab/window, send emails via Games table
4. Wait 60 seconds (component refetch interval)
5. Observe Settings page

**Expected Results**:
- ✅ Usage counters update automatically after 60 seconds
- ✅ Progress bars update to reflect new usage
- ✅ No page refresh needed

### Test 13: Multiple Users Independent Limits

**Objective**: Verify each user has independent daily limit

**Steps**:
1. User A sends 75 emails (at daily limit)
2. User B sends 0 emails
3. User B tries to send email

**Expected Results**:
- ✅ User A cannot send (at limit)
- ✅ User B can send normally (independent limit)
- ✅ Monthly system limit shared between both

### Test 14: Performance Under Load

**Objective**: Verify limit checks don't significantly slow down email sends

**Steps**:
1. Send bulk email to 50 recipients
2. Measure time to complete
3. Compare with/without limit checks (if possible)

**Expected Results**:
- ✅ Limit check adds < 100ms overhead
- ✅ Email sending completes in reasonable time
- ✅ No noticeable UI lag

## Regression Tests

### Existing Email Functionality

**Objective**: Verify existing email features still work

**Test Cases**:
1. ✅ Send individual game notification
2. ✅ Send bulk game schedule
3. ✅ Send email campaign via Email Groups
4. ✅ Receive welcome email on signup
5. ✅ Receive password reset email
6. ✅ Receive subscription confirmation email

**All should work without issues when within limits**

## Edge Cases

### Edge Case 1: Exactly at Limit
- User has sent exactly 75 emails
- Try to send 0 more (edge case)
- Should show appropriate message

### Edge Case 2: Negative Remaining
- Database somehow has 76 sent emails
- UI should handle gracefully (show 0 remaining)

### Edge Case 3: Very First Email
- Brand new user with 0 emails sent
- Should show 0/75 and allow sending

### Edge Case 4: Concurrent Sends
- User sends 5 emails simultaneously
- All should succeed (assuming within limit)
- Count should increment by 5

## Manual Testing Checklist

- [ ] Test 1: View Email Usage Stats (UI)
- [ ] Test 2: Email Usage API Endpoint
- [ ] Test 3: Send Email Within Limits
- [ ] Test 4: Daily Limit Enforcement
- [ ] Test 5: Daily Limit Partial Availability
- [ ] Test 6: Monthly Limit Enforcement (in test env)
- [ ] Test 7: System Emails Exempt from Limits
- [ ] Test 8: Rolling 24-Hour Window
- [ ] Test 9: Calendar Month Reset
- [ ] Test 10: Failed Emails Don't Count
- [ ] Test 11: Bulk Email Limit Check
- [ ] Test 12: Auto-Refresh UI
- [ ] Test 13: Multiple Users Independent Limits
- [ ] Test 14: Performance Under Load
- [ ] All Regression Tests Pass
- [ ] All Edge Cases Handled

## Automated Testing (Future)

Suggested test file structure:
```
tests/
  email-limits/
    email-limit-service.test.ts    # Unit tests for service
    email-limits-api.test.ts       # Integration tests for API
    email-limits-ui.test.ts        # E2E tests for UI component
```

## Cleanup After Testing

### Remove Test Data
```sql
-- Remove test email logs (if created for testing)
DELETE FROM "EmailLog" 
WHERE subject LIKE 'Test Email%' 
OR "to" @> ARRAY['test@example.com'];

-- Verify cleanup
SELECT COUNT(*) FROM "EmailLog";
```

## Known Limitations

1. **Monthly limit is system-wide**: One user could theoretically use all 100k emails
2. **No warning notifications**: Users aren't warned at 80%, 90% usage
3. **No email queue**: Emails fail immediately when limit reached
4. **Hard-coded limits**: Limits cannot be changed via UI or config

These are documented for future enhancements.

## Success Criteria

The feature is considered successful if:
- ✅ All 14 test cases pass
- ✅ No regression in existing email functionality
- ✅ Performance impact is minimal (< 100ms)
- ✅ UI displays accurate real-time usage
- ✅ Limits are enforced consistently
- ✅ Error messages are clear and helpful
- ✅ System emails continue to work
