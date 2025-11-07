# Bulk Email Testing Guide

## Overview

This guide explains how to safely test the bulk email functionality in the Athletic Director Hub application. The system uses Resend for email delivery and has been designed to handle large volumes of emails production-ready.

## Recent Improvements

### What Changed?

1. **Individual Email Delivery**: Each recipient now receives their own email instead of being included in a single email with all addresses visible
2. **Proper Tracking**: Each email gets its own log entry in the database for detailed tracking
3. **Rate Limiting**: Built-in batching (50 emails per batch) with delays to prevent API rate limit issues
4. **Email Validation**: All email addresses are validated before sending
5. **Error Handling**: Detailed error tracking per recipient with partial success handling
6. **Email Group Integration**: Game schedule emails can now be sent to bulk email groups

### Production Readiness

✅ **Individual Delivery** - Each recipient gets a private email (no exposed addresses)  
✅ **Batch Processing** - Handles large volumes with automatic batching  
✅ **Rate Limiting** - Built-in delays to respect Resend API limits  
✅ **Error Recovery** - Continues sending even if some emails fail  
✅ **Detailed Logging** - Individual email logs for tracking and debugging  
✅ **Email Validation** - Prevents invalid emails from causing failures

## Testing Workflows

### 1. Test with Email Groups (Recommended for Testing)

This is the safest way to test bulk emails as you have full control over the recipient list.

#### Step 1: Create a Test Email Group

1. Navigate to **Dashboard > Email Groups**
2. Click **"Create Email Group"**
3. Name it "Test Group" or "Test Bulk Emails"
4. Add test email addresses:
   - Use your own email addresses
   - Use test email services like:
     - [Mailtrap.io](https://mailtrap.io) - Email testing service
     - [MailHog](https://github.com/mailhog/MailHog) - Local email testing
     - Gmail with `+tag` addresses: `youremail+test1@gmail.com`, `youremail+test2@gmail.com`

#### Step 2: Send Test Campaign

**Option A: Send via Email Campaign**

1. Go to **Dashboard > Compose Email Campaign**
2. Select your test email group
3. Write a test subject and message
4. Click **"Send Campaign"**
5. Check **Dashboard > Email Logs** to see individual delivery status

**Option B: Send Game Schedule to Email Group**

1. Go to **Dashboard > Games**
2. Select one or more games (check the checkboxes)
3. Click **"Send Email (X)"** button
4. In the compose form:
   - Select **"Email Group (Bulk)"** as recipient category
   - Choose your test email group
   - Add any additional message
   - Click **"Send Email"**
5. Check **Dashboard > Email Logs** for delivery status

### 2. Test with Individual Games

#### Send Schedule to Custom Recipients

1. Navigate to **Dashboard > Games**
2. Select games you want to include
3. Click **"Send Email (X)"**
4. Select **"Custom Recipients"** as recipient category
5. Enter test emails separated by commas:
   ```
   test1@example.com, test2@example.com, test3@example.com
   ```
6. Add subject and message
7. Click **"Send Email"**

### 3. Testing Different Volumes

#### Small Volume (1-10 emails)

- Create a small test group with 1-10 addresses
- Send and verify all arrive within seconds
- Check Email Logs for all individual entries

#### Medium Volume (10-50 emails)

- Create a test group with 10-50 addresses
- Send and verify batch processing
- Should complete within 1-2 minutes

#### Large Volume (50+ emails)

- Create a test group with 50+ addresses
- Emails will be sent in batches of 50
- Each batch has a 1-second delay
- Monitor Email Logs for progress

## Verifying Success

### Check Email Logs

1. Go to **Dashboard > Email Logs**
2. You should see individual entries for each recipient
3. Each log shows:
   - Recipient email
   - Status (SENT or FAILED)
   - Timestamp
   - Associated games (if applicable)
   - Email group (if applicable)

### Status Meanings

- **SENT**: Email successfully delivered to Resend and queued for delivery
- **FAILED**: Email failed to send (check error message)
- **PENDING**: Email is being processed (should be rare)

### Troubleshooting Failed Emails

If you see failed emails:

1. **Check the error message** in the email log detail view
2. **Common issues**:
   - Invalid email address format
   - Resend API key not configured
   - Rate limit exceeded (should be rare with batching)
   - Network connectivity issues

## Resend Configuration

### Required Environment Variables

```bash
# .env or .env.local
NEXT_PUBLIC_RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="Athletic Director Hub <noreply@athleticdirectorhub.com>"
```

### Resend Dashboard

Monitor your email sending in the Resend dashboard:

1. Visit [resend.com/emails](https://resend.com/emails)
2. View real-time delivery status
3. Check bounce rates and errors
4. Monitor API usage

## Rate Limits

### Free Tier

- 100 emails per day
- 10 emails per second
- Good for testing and small schools

### Paid Tier (Growth)

- 50,000 emails per month
- 50 emails per second
- Suitable for medium to large schools

**Note**: Our implementation batches at 50 emails with 1-second delays, which safely handles both free and paid tiers.

## Best Practices

### For Testing

1. **Always test with your own emails first**
2. **Use email aliases** (Gmail +tags) to simulate multiple recipients
3. **Start small** (1-5 emails) before testing larger volumes
4. **Check logs immediately** after sending
5. **Use test email groups** - easier to manage and safer

### For Production

1. **Verify email groups** before sending to large lists
2. **Review the preview** before sending
3. **Send test emails** to yourself first
4. **Monitor Email Logs** after sending
5. **Check Resend dashboard** for delivery metrics
6. **Keep email lists updated** - remove bounces and invalid addresses

## Testing Checklist

Before going live with bulk emails:

- [ ] Resend API key is configured
- [ ] EMAIL_FROM domain is verified in Resend
- [ ] Test email group created with your own emails
- [ ] Sent test campaign to small group (1-5 emails)
- [ ] Verified individual emails received
- [ ] Checked Email Logs show individual entries
- [ ] Each email is private (no other recipients visible)
- [ ] Tested with medium volume (10-50 emails)
- [ ] Tested game schedule emails with email group
- [ ] Verified error handling (sent to invalid email)
- [ ] Confirmed partial success handling works

## Example Test Scenarios

### Scenario 1: Send Game Schedule to Coaches

```
1. Create email group "Test Coaches"
2. Add 3-5 test email addresses
3. In Games table, select 2-3 games
4. Click "Send Email"
5. Select "Email Group (Bulk)"
6. Choose "Test Coaches"
7. Add message: "Here is the upcoming schedule"
8. Send and verify
```

### Scenario 2: Test Error Handling

```
1. Create email group "Test Invalid"
2. Add mix of valid and invalid emails:
   - your-email@example.com (valid)
   - invalid-email (invalid format)
   - test@test (invalid)
3. Send campaign
4. Verify system shows partial success
5. Check Email Logs for specific failures
```

### Scenario 3: Large Volume Test

```
1. Create email group "Test Bulk"
2. Add 60 test emails (use Gmail aliases):
   - yourname+test1@gmail.com
   - yourname+test2@gmail.com
   - ... up to test60
3. Send campaign
4. Monitor Email Logs - should see batching in action
5. All 60 emails should arrive in your inbox
```

## Support and Documentation

### Resend Documentation

- [Resend Getting Started](https://resend.com/docs/introduction)
- [Resend API Reference](https://resend.com/docs/api-reference/introduction)
- [Rate Limits](https://resend.com/docs/api-reference/introduction#rate-limit)

### Email Testing Tools

- [Mailtrap](https://mailtrap.io) - Email sandbox
- [MailHog](https://github.com/mailhog/MailHog) - Local email testing
- [Temp Mail](https://temp-mail.org) - Temporary email addresses

## Troubleshooting Common Issues

### "Email service not configured"

**Solution**: Set `NEXT_PUBLIC_RESEND_API_KEY` in your environment variables

### "Invalid email addresses"

**Solution**: Check email format. Must be valid format: `user@domain.com`

### "Rate limit exceeded"

**Solution**: Wait a few minutes or upgrade Resend plan. Our batching should prevent this.

### Emails not arriving

**Solution**:

1. Check Email Logs for SENT status
2. Check spam/junk folder
3. Verify domain in Resend dashboard
4. Check Resend dashboard for bounces

### Some emails sent, others failed

**Solution**: This is expected behavior. Check Email Logs for specific failures and fix invalid addresses.

## Production Deployment Checklist

Before deploying to production:

- [ ] Resend paid plan activated (if sending >100 emails/day)
- [ ] Custom domain verified in Resend
- [ ] EMAIL_FROM uses verified domain
- [ ] Tested with production email volumes
- [ ] Email bounce monitoring set up
- [ ] Staff trained on email testing procedures
- [ ] Email groups properly organized
- [ ] Backup plan for email delivery issues

## Questions?

If you encounter issues not covered in this guide:

1. Check the Email Logs for detailed error messages
2. Check Resend dashboard for API errors
3. Review environment variables configuration
4. Contact support with specific error messages
