# Feedback and Notifications System

This document describes the feedback submission, support ticket, and notification system implemented in the Athletic Director Hub.

## Overview

The system provides:

1. Feedback submission with automatic notifications
2. Support ticket creation with automatic notifications
3. Automatic cleanup of old feedback and tickets
4. Email notifications to support team
5. Slack notifications for real-time monitoring

## Features

### 1. Feedback Submissions

When a user submits feedback through `/api/feedback`:

- **Database Storage**: Feedback is stored in the `FeedbackSubmission` table
- **Email Notification**: An email is sent to `support@athleticdirectorhub.com`
- **Slack Notification**: A formatted message is sent to the feedback Slack channel
- **Retention**: Feedback is automatically deleted after 90 days

### 2. Support Tickets

When a user creates a support ticket through `/api/support`:

- **Database Storage**: Ticket is stored in the `SupportTicket` table with a unique ticket number
- **Email Notification**: An email is sent to `support@athleticdirectorhub.com`
- **Slack Notification**: A formatted message is sent to the feedback Slack channel
- **Retention**: Closed/resolved tickets are automatically deleted after 90 days

### 3. Slack Notifications

Slack notifications include:

- **Time**: ISO timestamp of submission
- **Endpoint**: The API endpoint that was called
- **Customer**: User name and email
- **Body**: The feedback/ticket content

Example Slack message:

```
🎫 New Support Ticket
Time: 2024-01-15T10:30:00.000Z
Endpoint: /api/support
Customer: John Doe (john@example.com)
Message:
Ticket: SUPPORT-000123
Subject: Need help with scheduling
I'm having trouble scheduling games...
```

### 4. Email Notifications

Email notifications are sent to `support@athleticdirectorhub.com` with:

- Formatted HTML email
- Submitter information
- Full message content
- Timestamp
- Ticket number (for support tickets)

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Existing email configuration
NEXT_PUBLIC_RESEND_API_KEY="re_your_NEXT_PUBLIC_RESEND_API_KEY"
EMAIL_FROM="AD Hub <noreply@athleticdirectorhub.com>"

# New Slack webhook URL
SLACK_FEEDBACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Cron secret for automated cleanup
CRON_SECRET="your-shared-cron-secret"
```

### Setting up Slack Webhook

1. Go to your Slack workspace
2. Navigate to **Apps** → **Manage** → **Custom Integrations** → **Incoming Webhooks**
3. Click **Add to Slack**
4. Choose the channel for notifications (e.g., `#feedback`)
5. Copy the webhook URL
6. Add it to your `.env` file as `SLACK_FEEDBACK_WEBHOOK_URL`

## Data Retention

### Automatic Cleanup

The system includes a cron job endpoint (`/api/cron/cleanup-feedback`) that:

- Runs daily (recommended: 2 AM UTC)
- Deletes feedback submissions older than 90 days
- Deletes closed/resolved support tickets older than 90 days
- Keeps open support tickets indefinitely

See [CRON_SETUP.md](./CRON_SETUP.md) for detailed setup instructions.

### Manual Cleanup

You can manually trigger cleanup by calling:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://athleticdirectorhub.com/api/cron/cleanup-feedback
```

## API Endpoints

### POST /api/feedback

Submit user feedback.

**Request:**

```json
{
  "subject": "Feature Request",
  "message": "Would be great to have..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "subject": "Feature Request",
    "message": "Would be great to have...",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /api/support

Create a support ticket.

**Request:**

```json
{
  "subject": "Need help with scheduling",
  "description": "I'm having trouble..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "clx123...",
    "ticketNumber": "SUPPORT-000123",
    "subject": "Need help with scheduling",
    "description": "I'm having trouble...",
    "status": "OPEN",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### POST /api/cron/cleanup-feedback

Cleanup old feedback and tickets (requires CRON_SECRET).

**Headers:**

```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**

```json
{
  "success": true,
  "deletedFeedback": 5,
  "deletedTickets": 3
}
```

## Error Handling

All notification failures are logged but don't block the main operations:

- If email sending fails, the error is logged and the request continues
- If Slack notification fails, the error is logged and the request continues
- This ensures that user-facing operations always complete successfully

## Testing

### Test Feedback Submission

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{"subject":"Test","message":"This is a test"}'
```

### Test Support Ticket

```bash
curl -X POST http://localhost:3000/api/support \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION" \
  -d '{"subject":"Test Ticket","description":"This is a test ticket"}'
```

### Test Cleanup

```bash
curl -X POST http://localhost:3000/api/cron/cleanup-feedback \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

### Logs

All operations are logged with structured data:

- `console.log`: Successful operations
- `console.warn`: Non-critical warnings
- `console.error`: Errors that need attention

### Metrics to Monitor

1. **Feedback submission rate**: Track number of submissions over time
2. **Ticket creation rate**: Monitor ticket volume
3. **Notification failures**: Watch for email/Slack failures
4. **Cleanup efficiency**: Ensure old data is being properly deleted

## Troubleshooting

### Emails not being sent

1. Check `NEXT_PUBLIC_RESEND_API_KEY` is set correctly
2. Verify `EMAIL_FROM` domain is verified in Resend
3. Check application logs for errors

### Slack notifications not appearing

1. Verify `SLACK_FEEDBACK_WEBHOOK_URL` is correct
2. Test the webhook URL manually:
   ```bash
   curl -X POST YOUR_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"text":"Test message"}'
   ```
3. Check that the Slack app hasn't been removed from the channel

### Cleanup not running

1. Verify cron job is properly configured
2. Check `CRON_SECRET` matches in both .env and cron service
3. Review cron service logs for errors
4. Test the endpoint manually
