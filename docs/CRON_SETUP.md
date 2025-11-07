# Cron Job Setup

This document describes the cron jobs that need to be set up for the Athletic Director Hub application.

## Feedback and Support Ticket Cleanup

This cron job automatically deletes feedback submissions and closed/resolved support tickets that are older than 90 days.

### Endpoint

```
POST /api/cron/cleanup-feedback
```

### Authentication

The endpoint requires a Bearer token in the Authorization header using the `CRON_SECRET` environment variable.

### Setup Instructions

#### Option 1: Using Vercel Cron Jobs

Add the following to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-feedback",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This will run the cleanup job daily at 2:00 AM UTC.

#### Option 2: Using External Cron Service (e.g., cron-job.org, EasyCron)

Configure the external service with:

- URL: `https://athleticdirectorhub.com/api/cron/cleanup-feedback`
- Method: POST
- Schedule: Daily at 2:00 AM
- Headers: `Authorization: Bearer YOUR_CRON_SECRET`

#### Option 3: Using GitHub Actions

Create `.github/workflows/cleanup-cron.yml`:

```yaml
name: Cleanup Feedback and Tickets

on:
  schedule:
    - cron: "0 2 * * *" # Daily at 2 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger cleanup
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://athleticdirectorhub.com/api/cron/cleanup-feedback
```

### Testing

You can manually test the cron job by running:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/cleanup-feedback
```

Replace `YOUR_CRON_SECRET` with the value from your `.env` file.

### Response

The endpoint returns:

```json
{
  "success": true,
  "deletedFeedback": 5,
  "deletedTickets": 3
}
```

## Notes

- Feedback is deleted after 90 days regardless of status
- Support tickets are only deleted if they are in "CLOSED" or "RESOLVED" status and are older than 90 days
- Open tickets are retained indefinitely
