# Resend Email Limits Implementation

## Summary
Implemented email sending limits for the Resend email service integration:
- **Per-User Daily Limit**: 75 emails per 24 hours
- **Global Monthly Limit**: 100,000 emails per calendar month (system-wide)

## Files Created

### 1. Email Limit Service
**File**: `/src/lib/services/email-limit.service.ts`

Core service that handles all email limit checking logic:
- `checkEmailLimits(userId, emailCount)`: Validates both daily and monthly limits
- `canUserSendEmails(userId, emailCount)`: Check per-user daily limit (75/day)
- `canSystemSendEmails(emailCount)`: Check system-wide monthly limit (100k/month)
- `getUserDailyEmailCount(userId)`: Count emails sent in last 24 hours
- `getGlobalMonthlyEmailCount()`: Count emails sent this calendar month
- `getUserEmailStats(userId)`: Get comprehensive usage statistics

### 2. API Endpoint
**File**: `/src/app/api/email/limits/route.ts`

GET endpoint that returns email usage statistics:
```json
{
  "success": true,
  "data": {
    "daily": {
      "used": 15,
      "limit": 75,
      "remaining": 60,
      "percentage": 20
    },
    "monthly": {
      "used": 45230,
      "limit": 100000,
      "remaining": 54770,
      "percentage": 45
    }
  }
}
```

### 3. UI Component
**File**: `/src/components/settings/EmailLimitsCard.tsx`

React component that displays email usage in the Settings page:
- Real-time progress bars for daily and monthly limits
- Color-coded indicators (green → yellow → red as usage increases)
- Auto-refreshes every minute via TanStack Query
- Shows remaining email counts
- Info tooltip explaining the limits

## Files Modified

### 1. Bulk Email Utility
**File**: `/src/lib/utils/bulk-email.ts`

**Changes**:
- Added import: `import { emailLimitService } from "../services/email-limit.service"`
- Added limit check before sending bulk emails
- Updated comments to reflect new limits (75/day, 100k/month)

**Code Added**:
```typescript
// Check email limits before sending
const limitCheck = await emailLimitService.checkEmailLimits(sentById, to.length);
if (!limitCheck.allowed) {
  throw new Error(limitCheck.reason || "Email limit exceeded");
}
```

### 2. Email Service
**File**: `/src/lib/services/email.service.ts`

**Changes**:
- Added import: `import { emailLimitService } from "./email-limit.service"`
- Added limit check in `sendEmail()` method
- Only checks limits for user-sent emails (skips system emails)

**Code Added**:
```typescript
// Check email limits if user is sending (skip for system emails)
if (sentById) {
  const recipientCount = to.length + cc.length;
  const limitCheck = await emailLimitService.checkEmailLimits(sentById, recipientCount);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason || "Email limit exceeded");
  }
}
```

### 3. Settings Page
**File**: `/src/app/dashboard/settings/page.tsx`

**Changes**:
- Added import: `import { EmailLimitsCard } from "@/components/settings/EmailLimitsCard"`
- Added `<EmailLimitsCard />` component to display usage stats

## Documentation

### Full Documentation
**File**: `/docs/EMAIL_LIMITS_FEATURE.md`

Comprehensive documentation covering:
- Feature overview and limits
- Implementation details
- API endpoints and responses
- UI components
- User experience and error messages
- Database schema usage
- Testing instructions
- Future enhancement ideas
- Security considerations

## How It Works

### Limit Enforcement Flow

1. **User initiates email send** (bulk or individual)
2. **Service checks limits**:
   - First checks user's daily limit (last 24 hours)
   - Then checks system monthly limit (current calendar month)
3. **If limit exceeded**:
   - Throws descriptive error with details
   - No emails are sent
4. **If within limits**:
   - Proceeds with email sending
   - Creates EmailLog entry with status 'SENT'

### Email Counting

Only **successfully sent** emails count toward limits:
- Query filter: `status = 'SENT'`
- Failed emails don't count
- System emails (password reset, etc.) exempt from limits

### Database Usage

Uses existing `EmailLog` table:
- `sentById`: Identifies user who sent email
- `sentAt`: Timestamp for rolling/calendar window calculations
- `status`: Only 'SENT' emails count toward limits

No database schema changes required!

## User Experience

### Settings Page Display
Users can see their current usage:
- Daily: "15 / 75 emails" with progress bar
- Monthly: "45,230 / 100,000 emails" with progress bar
- Remaining counts shown below each bar
- Color changes as they approach limits

### Error Messages

**Daily Limit Exceeded**:
```
Daily email limit exceeded. You have sent 75 of 75 emails today. Please try again tomorrow.
```

**Monthly Limit Exceeded**:
```
System-wide monthly email limit reached. 100,000 of 100,000 emails sent this month. Limit will reset at the start of next month.
```

**Approaching Limit** (60 remaining):
```
Daily email limit exceeded. You have sent 15 of 75 emails today. You can send 60 more emails.
```

## Testing

### Manual Testing Steps

1. **View Usage Stats**:
   - Navigate to Settings page
   - Scroll to "Email Usage" card
   - Verify current usage displays correctly

2. **Send Emails**:
   - Go to Games table
   - Select games and send emails
   - Return to Settings → verify usage increased

3. **Test Daily Limit**:
   - Send 75 emails (or set limit lower for testing)
   - Attempt to send more
   - Verify error message displays

4. **Test Monthly Limit**:
   - Monitor monthly usage
   - As admin, verify system-wide count is accurate

### API Testing

```bash
# Get current usage stats
curl -X GET http://localhost:3000/api/email/limits \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Expected response:
{
  "success": true,
  "data": {
    "daily": { "used": 15, "limit": 75, "remaining": 60, "percentage": 20 },
    "monthly": { "used": 45230, "limit": 100000, "remaining": 54770, "percentage": 45 }
  }
}
```

## Integration Points

All email sending in the application now goes through the limit checks:

1. **Bulk Email Sends** (via Games table)
2. **Individual Email Sends** (via Email Service)
3. **Email Campaigns** (via Email Groups)
4. **Game Notifications** (via sendGameNotification method)

System emails are **exempt** from limits:
- Welcome emails
- Password reset emails
- Account verification emails
- Subscription confirmation emails
- Payment receipts

## Performance Considerations

### Query Efficiency
- Uses indexed fields for fast counting:
  - `@@index([sentById])`
  - `@@index([status])`
  - `@@index([sentAt])`

### Caching
- UI component auto-refreshes every 60 seconds
- API endpoint responds quickly (simple COUNT queries)

## Security

- **Server-side enforcement**: Limits cannot be bypassed via client
- **Audit trail**: All emails logged in `EmailLog` table
- **Granular control**: Different limits for users vs system
- **Fail-safe**: Errors prevent sending when limit reached

## Future Enhancements

Potential improvements for future iterations:

1. **Admin Dashboard**: View all users' email usage
2. **Configurable Limits**: ENV variables for custom limits per deployment
3. **Role-based Limits**: Different limits for different user roles/plans
4. **Email Queue**: Queue emails when limit reached, send when available
5. **Proactive Notifications**: Alert users at 80%, 90% usage
6. **Historical Analytics**: Track usage trends over time
7. **Rate Limiting**: Add per-second/per-minute rate limiting

## Deployment Notes

- No database migrations required (uses existing EmailLog table)
- No environment variables required (limits hard-coded)
- Backward compatible (existing email functionality unchanged)
- Zero downtime deployment

## Support

For questions or issues with email limits:
- See full documentation: `/docs/EMAIL_LIMITS_FEATURE.md`
- Check Settings page for current usage
- Contact support if limits need adjustment
