# Bulk Email - Quick Start Guide

## 5-Minute Testing Workflow

### Prerequisites

- Resend API key configured in `.env`
- Application running locally or deployed

### Step 1: Create Test Email Group (2 minutes)

1. Login to the dashboard
2. Navigate to **Dashboard > Email Groups**
3. Click **"Create Email Group"**
4. Enter details:
   ```
   Name: Test Group
   Description: For testing bulk emails
   ```
5. Click **Create**
6. Add test emails:
   ```
   Click "Add Email" for each:
   - your-email+test1@gmail.com
   - your-email+test2@gmail.com
   - your-email+test3@gmail.com
   ```
   _Note: Gmail ignores everything after the `+` so all emails arrive in your inbox_

### Step 2: Test Game Schedule Email (2 minutes)

1. Navigate to **Dashboard > Games**
2. If no games exist, create one:
   - Click **"Create Game"**
   - Fill in required fields
   - Click **Save**
3. Select the game (checkbox)
4. Click **"Send Email (1)"** button
5. In the compose form:
   - **Recipient Category**: Select "Email Group (Bulk)"
   - **Select Email Group**: Choose "Test Group"
   - **Subject**: "Test Game Schedule"
   - **Additional Message**: "This is a test email"
6. Click **"Send Email"**

### Step 3: Verify Success (1 minute)

1. Navigate to **Dashboard > Email Logs**
2. You should see 3 entries (one per recipient)
3. Each entry shows:
   - Status: **SENT** ✅
   - Individual recipient email
   - Timestamp
4. Check your email inbox:
   - You should have 3 emails
   - Each addressed only to you (no other recipients visible)
   - All have the same game schedule content

### Step 4: Test Campaign (Optional)

1. Navigate to **Dashboard > Compose Email Campaign**
2. Select "Test Group"
3. Enter:
   ```
   Subject: Test Campaign
   Message: This is a test campaign message.
   ```
4. Click **"Send Campaign"**
5. Check Email Logs again - 3 more entries

## What's Happening Behind the Scenes?

```
Your Action: Send to "Test Group" (3 emails)
    ↓
System validates: ✅ All emails valid
    ↓
System sends individually:
    ➊ Send to your-email+test1@gmail.com → EmailLog #1
    ➋ Send to your-email+test2@gmail.com → EmailLog #2
    ➌ Send to your-email+test3@gmail.com → EmailLog #3
    ↓
All 3 emails arrive separately in inbox
```

## Expected Results

### ✅ Success Indicators

- Email Logs show individual entries for each recipient
- Each entry has "SENT" status
- Each email arrives in your inbox
- No other recipients visible in any email
- Total emails = number of recipients

### ❌ Failure Indicators (and fixes)

- "Email service not configured" → Set `NEXT_PUBLIC_RESEND_API_KEY` in `.env`
- "No recipients in group" → Add emails to the group
- "Invalid email addresses" → Check email format
- Some emails FAILED → Check Email Logs for specific errors

## Testing Larger Volumes

### 10 Recipients

Create 10 test emails using Gmail aliases:

```
your-email+test1@gmail.com
your-email+test2@gmail.com
...
your-email+test10@gmail.com
```

### 50+ Recipients

For larger tests, consider:

1. Using [Mailtrap.io](https://mailtrap.io) test inbox
2. Creating multiple real test accounts
3. Using temporary email services (for testing only)

## Production Readiness Checklist

Before using with real email groups:

- [ ] Tested with personal email group (3-5 emails)
- [ ] Verified individual email delivery (no exposed addresses)
- [ ] Checked Email Logs for proper tracking
- [ ] Tested with 10+ emails
- [ ] Confirmed partial failure handling
- [ ] Set up Resend paid plan (if sending >100 emails/day)
- [ ] Verified custom domain in Resend
- [ ] Trained staff on email testing procedures

## Quick Reference

| Feature              | Location                           | Purpose                        |
| -------------------- | ---------------------------------- | ------------------------------ |
| Email Groups         | Dashboard > Email Groups           | Manage recipient lists         |
| Game Schedule Emails | Games > Send Email                 | Send schedules to groups       |
| Email Campaigns      | Dashboard > Compose Email Campaign | Send custom messages to groups |
| Email Logs           | Dashboard > Email Logs             | Track all sent emails          |

## Next Steps

1. ✅ Complete the 5-minute test workflow above
2. 📖 Read the full [Bulk Email Testing Guide](./BULK_EMAIL_TESTING_GUIDE.md)
3. 🔍 Review [Bulk Email Improvements](../BULK_EMAIL_IMPROVEMENTS.md) for technical details
4. 🚀 Start using with real email groups

## Support

For issues or questions:

1. Check Email Logs for detailed error messages
2. Review [Bulk Email Testing Guide](./BULK_EMAIL_TESTING_GUIDE.md)
3. Check Resend dashboard for API errors
4. Verify environment variables are set correctly
