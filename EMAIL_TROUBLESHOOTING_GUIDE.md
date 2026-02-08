# Email System Troubleshooting Guide

## Quick Diagnosis

Use this flowchart to quickly identify your issue:

```
Email not sending?
│
├─ Getting 503 error?
│  └─ Check: Is RESEND_API_KEY set? → See Issue #1
│
├─ Getting 400 error with "Invalid email addresses"?
│  └─ Check: Email format → See Issue #2
│
├─ Getting 500 error?
│  ├─ Check logs for "createManyAndReturn failed" → See Issue #3
│  └─ Check logs for "Resend batch API error" → See Issue #4
│
├─ Email sent but logo not showing?
│  └─ Check: SITE_URL environment variable → See Issue #5
│
├─ Getting "Email limit exceeded"?
│  └─ Check: User's daily/monthly limits → See Issue #6
│
└─ Emails sent successfully but not appearing in logs?
   └─ Check: Database connection → See Issue #7
```

---

## Issue #1: Email Service Not Configured (503 Error)

### Symptoms
- API returns 503 error
- Error message: "Email service not configured. Please set RESEND_API_KEY."
- Log shows: `[RESEND] RESEND_API_KEY not configured`

### Diagnosis
```bash
# Check if RESEND_API_KEY is set
echo $RESEND_API_KEY

# Check if it's in your .env file
grep RESEND_API_KEY .env

# Check if Next.js loaded it
# In your API route, add: console.log(process.env.RESEND_API_KEY)
```

### Solution
1. **Set the environment variable**:
   ```bash
   # In .env file
   RESEND_API_KEY=re_your_api_key_here
   ```

2. **Verify the format**:
   - Must start with `re_`
   - Should be around 32+ characters
   - Get from: https://resend.com/api-keys

3. **Restart your application**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build && npm start
   ```

4. **Verify in platform-specific ways**:
   - **Vercel**: Set in dashboard → Settings → Environment Variables
   - **Railway**: Set in dashboard → Variables
   - **Docker**: Pass with `-e` flag or in docker-compose.yml

### Prevention
- Add to `.env.example` as a reminder
- Document in deployment instructions
- Add health check endpoint that verifies API key exists

---

## Issue #2: Invalid Email Format (400 Error)

### Symptoms
- API returns 400 error
- Error message: "Invalid email addresses: [...]"
- Log shows: `[EMAIL-API] Invalid emails detected`

### Diagnosis
```typescript
// Test email validation
import { validateBulkEmails } from '@/lib/utils/bulk-email';

const { valid, invalid } = validateBulkEmails([
  'test@example.com',     // Valid
  'invalid-email',        // Invalid
  'test@',                // Invalid
  '@example.com',         // Invalid
]);

console.log('Valid:', valid);
console.log('Invalid:', invalid);
```

### Common Invalid Formats
| Email | Issue | Fix |
|-------|-------|-----|
| `user` | No @ symbol | `user@domain.com` |
| `user@` | No domain | `user@domain.com` |
| `@domain.com` | No local part | `user@domain.com` |
| `user @domain.com` | Space in email | `user@domain.com` |
| `user@domain` | No TLD | `user@domain.com` |
| `"user"@domain.com` | Quotes | `user@domain.com` |

### Solution
1. **Validate before sending**:
   ```typescript
   const emails = ['user1@test.com', 'user2@test.com'];
   const { valid, invalid } = validateBulkEmails(emails);
   
   if (invalid.length > 0) {
     console.error('Invalid emails:', invalid);
     return; // Don't send
   }
   ```

2. **Fix in UI**: Add real-time validation in email input fields

3. **Import validation**: When importing from CSV, validate emails

### Prevention
- Use `<input type="email">` in forms
- Add client-side validation with regex
- Show validation errors immediately
- Validate on paste/import

---

## Issue #3: Database Error (500 Error)

### Symptoms
- API returns 500 error sometimes
- Log shows: `createManyAndReturn failed`
- Emails are sent but logs not created

### Diagnosis
```bash
# Check database connection
npm run db:studio

# Check database logs
# Look for connection errors or query timeouts

# Test Prisma connection
node -e "
  const { prisma } = require('./src/lib/database/prisma');
  prisma.\$connect()
    .then(() => console.log('Connected'))
    .catch(e => console.error('Failed:', e));
"
```

### Solution
1. **Verify DATABASE_URL**:
   ```bash
   # Check if set
   echo $DATABASE_URL
   
   # Format should be:
   # postgresql://user:password@host:5432/dbname
   ```

2. **Check database permissions**:
   ```sql
   -- User should have INSERT permission on EmailLog table
   GRANT INSERT ON "EmailLog" TO your_user;
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   # or
   npm run migrate:deploy
   ```

4. **Check connection pool**:
   ```typescript
   // In prisma.ts, ensure proper connection limits
   datasource db {
     url = env("DATABASE_URL")
     // Add connection pooling if needed
   }
   ```

### The Code Already Has a Fallback!
The system automatically falls back to individual inserts if batch fails:
```typescript
try {
  // Try batch insert
  createdLogs = await prisma.emailLog.createManyAndReturn({ data });
} catch (error) {
  // Fallback to individual inserts
  for (const log of data) {
    createdLogs.push(await prisma.emailLog.create({ data: log }));
  }
}
```

So if you see this error, emails are still sent! Just check your database.

---

## Issue #4: Resend API Error

### Symptoms
- API returns 500 error
- Log shows: `Resend batch API error`
- Specific Resend error codes in logs

### Common Resend Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `401` | Invalid API key | Check RESEND_API_KEY |
| `403` | Domain not verified | Verify domain in Resend dashboard |
| `422` | Invalid email format | Check email addresses |
| `429` | Rate limit exceeded | Wait 1 minute, retry |
| `500` | Resend server error | Retry automatically (system does this) |

### Diagnosis
```bash
# Test Resend API directly
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@yourdomain.com",
    "to": ["test@example.com"],
    "subject": "Test",
    "html": "<p>Test</p>"
  }'
```

### Solution
1. **Verify domain in Resend**:
   - Go to https://resend.com/domains
   - Add your domain
   - Verify DNS records

2. **Check EMAIL_FROM variable**:
   ```bash
   # Must use verified domain
   EMAIL_FROM="Your App <noreply@verified-domain.com>"
   ```

3. **Check rate limits**:
   - Free tier: 100 emails/day
   - Pro tier: 10,000 emails/month
   - Upgrade if needed

4. **Wait for retries**:
   - System retries automatically up to 2 times
   - Check logs for retry attempts

---

## Issue #5: Signature Logo Not Displaying

### Symptoms
- Email sent successfully
- Signature text appears
- Logo image broken or missing
- Log shows: `Logo URL does not start with http(s)`

### Diagnosis
```bash
# Check SITE_URL variables
echo $NEXT_PUBLIC_SITE_URL
echo $SITE_URL
echo $NEXTAUTH_URL

# Check logo URL in database
# Should be absolute URL like: https://domain.com/uploads/logo.png
# NOT relative like: /uploads/logo.png

# Check the log output
# Look for: [EMAIL-SIG] Final logo URL: ...
```

### Solution
1. **Set site URL environment variable**:
   ```bash
   # In .env file (choose one)
   NEXT_PUBLIC_SITE_URL=https://yourdomain.com
   # OR
   SITE_URL=https://yourdomain.com
   # OR
   NEXTAUTH_URL=https://yourdomain.com
   ```

2. **Verify logo is publicly accessible**:
   ```bash
   # Test logo URL in browser
   # Should load without requiring login
   https://yourdomain.com/uploads/logo.png
   ```

3. **Check logo storage**:
   - Logos should be in `public/uploads/`
   - Or use cloud storage (S3, Cloudinary, etc.)
   - Ensure no authentication required

4. **Update existing logos**:
   ```sql
   -- Check current logo URLs
   SELECT id, "signatureLogoUrl" FROM "User" 
   WHERE "signatureLogoUrl" IS NOT NULL;
   
   -- They should be auto-converted by the code
   -- But if needed, manually update:
   UPDATE "User" 
   SET "signatureLogoUrl" = 'https://yourdomain.com' || "signatureLogoUrl"
   WHERE "signatureLogoUrl" LIKE '/%';
   ```

---

## Issue #6: Email Limit Exceeded

### Symptoms
- Error message: "Email limit exceeded"
- Log shows: `Daily email limit exceeded` or `Monthly email limit for your plan exceeded`

### Understanding Limits

**Per-User Daily Limit**: 75 emails/day
- Resets every 24 hours
- Prevents abuse
- Cannot be increased

**Per-User Monthly Limit**: Based on subscription plan
- Free: 100 emails/month
- Standard: 1,000 emails/month
- Team: 5,000 emails/month
- Plus: 10,000 emails/month

**System-Wide Monthly**: 100,000 emails/month
- Prevents platform abuse
- Rarely hit

### Diagnosis
```typescript
// Check user's email usage
GET /api/email/limits

// Response:
{
  "dailyUsed": 45,
  "dailyLimit": 75,
  "dailyRemaining": 30,
  "monthlyUsed": 500,
  "monthlyLimit": 1000,
  "monthlyRemaining": 500
}
```

### Solution
1. **Wait for reset**:
   - Daily limit resets after 24 hours
   - Monthly limit resets on 1st of month

2. **Upgrade plan**:
   - Go to billing settings
   - Upgrade to higher tier
   - Limits increase immediately

3. **Batch strategically**:
   ```typescript
   // Instead of sending all at once
   // Split into multiple days
   const batch1 = emails.slice(0, 70);  // Day 1
   const batch2 = emails.slice(70, 140); // Day 2
   ```

4. **Check for orphaned logs**:
   ```sql
   -- Sometimes failed emails still count
   -- Check for FAILED status
   SELECT COUNT(*) FROM "EmailLog"
   WHERE "sentById" = 'user-id'
   AND "sentAt" > NOW() - INTERVAL '24 hours'
   AND status = 'FAILED';
   
   -- These shouldn't count, but verify
   ```

---

## Issue #7: Emails Sent But Not in Logs

### Symptoms
- Email received successfully
- Not appearing in email logs dashboard
- Database query shows no records

### Diagnosis
```sql
-- Check if logs exist at all
SELECT COUNT(*) FROM "EmailLog";

-- Check for specific user
SELECT COUNT(*) FROM "EmailLog" 
WHERE "sentById" = 'user-id';

-- Check recent logs
SELECT * FROM "EmailLog" 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Solution
1. **Check database connection during send**:
   - Look for `[EMAIL] Creating X email logs in database`
   - Should be followed by success message

2. **Verify Prisma schema**:
   ```bash
   npm run prisma:generate
   npm run db:migrate
   ```

3. **Check for errors in logs**:
   ```bash
   # Look for:
   # "Failed to create email logs"
   # "createManyAndReturn failed"
   ```

4. **Manual verification**:
   ```sql
   -- Insert test log
   INSERT INTO "EmailLog" (
     id, "to", subject, body, status, "sentById", "createdAt"
   ) VALUES (
     gen_random_uuid(), 
     ARRAY['test@example.com'], 
     'Test', 
     'Test body', 
     'SENT', 
     'user-id', 
     NOW()
   );
   ```

---

## General Debugging Steps

### 1. Enable Detailed Logging
```typescript
// In bulk-email.ts and send/route.ts
// Logs are already comprehensive!

// To see all logs:
// Development:
npm run dev | grep EMAIL

// Production:
// Check your platform's logging
vercel logs --follow  # Vercel
railway logs          # Railway
docker logs -f app    # Docker
```

### 2. Test with Single Email
```bash
# Always test with 1 email first
curl -X POST http://localhost:3000/api/email/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["your-email@example.com"],
    "subject": "Test Email",
    "gameIds": ["game-id"]
  }'
```

### 3. Check All Environment Variables
```bash
# Create a checklist
✅ RESEND_API_KEY (starts with re_)
✅ EMAIL_FROM (uses verified domain)
✅ NEXT_PUBLIC_SITE_URL or SITE_URL
✅ DATABASE_URL
✅ NEXTAUTH_SECRET
```

### 4. Review Recent Changes
```bash
# Check git history
git log --oneline -10

# Check what changed in email files
git diff main src/lib/utils/bulk-email.ts
git diff main src/app/api/email/send/route.ts
```

### 5. Test Resend Dashboard
- Go to https://resend.com/emails
- Check recent sends
- Look for errors
- Verify domain status

---

## Emergency Fixes

### Quick Fix #1: Bypass Email Sending (Testing Only)
```typescript
// In bulk-email.ts, temporarily:
export async function sendBulkEmail(params: SendBulkEmailParams) {
  // TESTING ONLY - REMOVE AFTER DEBUGGING
  console.log('[EMAIL] BYPASSED - Would send to:', params.to);
  return {
    success: params.to.length,
    failed: 0,
    errors: [],
    emailLogIds: []
  };
}
```

### Quick Fix #2: Force Email Through (Development Only)
```typescript
// In send/route.ts, temporarily skip limits:
const result = await sendBulkEmail({
  to: validEmails,
  subject,
  html: emailBody,
  sentById: session.user.id,
  replyTo,
  ...emailParams,
});

// Skip limit checks (ONLY FOR TESTING)
```

### Quick Fix #3: Manual Email Send
```bash
# Send email directly via Resend API
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": ["your-email@example.com"],
    "subject": "Emergency Test",
    "html": "<p>If you receive this, Resend works!</p>"
  }'
```

---

## Getting Help

If none of these solutions work:

1. **Collect information**:
   ```bash
   # Copy these details:
   - Error message (full text)
   - Request ID from logs
   - Environment (dev/prod, platform)
   - Number of recipients
   - Whether logo is used
   - Recent code changes
   ```

2. **Check the logs**:
   ```bash
   # Search for your request ID
   grep "EMAIL-API.*abc123" logs.txt
   # (where abc123 is your request ID)
   ```

3. **Create minimal reproduction**:
   - Test with 1 email
   - Remove signature
   - Use simple subject/body

4. **File an issue** with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Full error logs (with sensitive data redacted)
   - Environment details

---

## Preventive Maintenance

### Weekly Checks
- [ ] Monitor email sending success rate
- [ ] Check for failed emails in logs
- [ ] Verify Resend API key is valid
- [ ] Review email limits usage

### Monthly Checks
- [ ] Review email logs for patterns
- [ ] Check database storage (email logs grow)
- [ ] Update Resend API if needed
- [ ] Test signature logos still work

### Quarterly Checks
- [ ] Review and archive old email logs
- [ ] Update documentation
- [ ] Test disaster recovery
- [ ] Review rate limits vs usage

---

## Performance Optimization

### If Emails Are Slow
1. **Batch size**: Already optimized at 100
2. **Delay**: 200ms between batches (optimal)
3. **Database**: Consider indexing `sentById` and `sentAt`
4. **Monitoring**: Add APM if needed

### If Database Growing Too Large
```sql
-- Archive old email logs (older than 90 days)
DELETE FROM "EmailLog" 
WHERE "createdAt" < NOW() - INTERVAL '90 days'
AND status = 'SENT';

-- Or move to archive table
CREATE TABLE "EmailLogArchive" (LIKE "EmailLog");
INSERT INTO "EmailLogArchive" 
SELECT * FROM "EmailLog" 
WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

---

## Summary Checklist

Before contacting support, verify:

- [ ] RESEND_API_KEY is set and starts with "re_"
- [ ] EMAIL_FROM uses a verified domain
- [ ] SITE_URL or NEXT_PUBLIC_SITE_URL is set
- [ ] Database connection works
- [ ] Email addresses are valid format
- [ ] Not hitting rate limits
- [ ] Logs show where it's failing
- [ ] Tested with single simple email
- [ ] Checked Resend dashboard for errors

If all checked and still failing, it's likely a platform-specific issue or Resend API problem.
