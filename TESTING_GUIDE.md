# Collaboration Email Tracking - Testing Guide

## Setup

1. Ensure database migrations are applied:
   ```bash
   npx prisma migrate dev
   ```

2. Ensure environment variables are set:
   - `RESEND_API_KEY` (for testing email sending)
   - `EMAIL_FROM` (optional, defaults to "Opletics <noreply@opletics.com>")
   - `NEXT_PUBLIC_APP_URL` (for correct invitation links)

## Test Scenarios

### Scenario 1: Successful Invitation Email

**Setup:**
- RESEND_API_KEY is properly configured
- Valid email address

**Steps:**
1. Authenticate as a user
2. POST to `/api/collaboration/invite` with:
   ```json
   {
     "email": "test@example.com",
     "role": "MEMBER"
   }
   ```

**Expected Results:**
- HTTP 200 OK
- Response:
  ```json
  {
    "success": true,
    "message": "Invitation sent successfully",
    "collaboratorId": "...",
    "emailSent": true,
    "emailError": null
  }
  ```
- CollaborativeMember record has:
  - `emailSent: true`
  - `emailSentAt: <timestamp>`
  - `emailError: null`
- Email is received by test@example.com
- Audit log entry with action: `INVITE_CREATED`

**Verification:**
```sql
SELECT emailSent, emailSentAt, emailError
FROM "CollaborativeMember"
WHERE id = '<collaboratorId>';
```

---

### Scenario 2: Email Service Not Configured

**Setup:**
- RESEND_API_KEY is NOT set or empty

**Steps:**
1. Authenticate as a user
2. POST to `/api/collaboration/invite` with:
   ```json
   {
     "email": "test@example.com",
     "role": "MEMBER"
   }
   ```

**Expected Results:**
- HTTP 200 OK (invitation still created)
- Response:
  ```json
  {
    "success": true,
    "message": "Invitation created but email failed to send. Please check your email configuration.",
    "collaboratorId": "...",
    "emailSent": false,
    "emailError": "Email service not configured. Please set RESEND_API_KEY environment variable..."
  }
  ```
- CollaborativeMember record has:
  - `emailSent: false`
  - `emailSentAt: null`
  - `emailError: "Email service not configured..."`

**Console Logs:**
```
Failed to send invitation email: Error: Email service not configured...
```

---

### Scenario 3: Invalid RESEND_API_KEY Format

**Setup:**
- RESEND_API_KEY is set but doesn't start with `re_`

**Steps:**
1. Set RESEND_API_KEY to invalid format (e.g., "invalid_key")
2. POST to `/api/collaboration/invite`

**Expected Results:**
- HTTP 200 OK
- Response with `emailSent: false`
- Error message: "RESEND_API_KEY is set but has invalid format..."

---

### Scenario 4: Check Email Health

**Setup:**
- Any authentication state

**Steps:**
1. GET `/api/collaboration/email-health`

**Expected Results (with valid key):**
```json
{
  "success": true,
  "configured": true,
  "configuredCorrectly": true
}
```

**Expected Results (without key):**
```json
{
  "success": true,
  "configured": false,
  "configuredCorrectly: false,
  "error": "RESEND_API_KEY environment variable is not set"
}
```

---

### Scenario 5: List Members with Email Status

**Setup:**
- User has existing collaborators (some with emails sent, some failed)

**Steps:**
1. GET `/api/collaboration/members`

**Expected Results:**
```json
{
  "success": true,
  "members": [
    {
      "id": "...",
      "email": "user1@example.com",
      "role": "MEMBER",
      "status": "ACCEPTED",
      "emailSent": true,
      "emailSentAt": "2025-02-18T10:30:00.000Z",
      "emailError": null
    },
    {
      "id": "...",
      "email": "user2@example.com",
      "role": "VIEWER",
      "status": "PENDING",
      "emailSent": false,
      "emailSentAt": null,
      "emailError": "Email service not configured..."
    }
  ],
  "totalCount": 2,
  "usedSlots": 2,
  "availableSlots": 4,
  "collaboratorLimit": 6
}
```

---

### Scenario 6: Resend Failed Email

**Setup:**
- CollaborativeMember exists with `emailSent: false`
- Invitation has not expired
- Invitation has not been accepted or revoked

**Steps:**
1. Set up RESEND_API_KEY correctly
2. POST to `/api/collaboration/resend-email` with:
   ```json
   {
     "collaboratorId": "<failed_invitation_id>"
   }
   ```

**Expected Results:**
- HTTP 200 OK
- Response:
  ```json
  {
    "success": true,
    "message": "Invitation email sent successfully",
    "collaboratorId": "...",
    "emailSent": true
  }
  ```
- CollaborativeMember record updated:
  - `emailSent: true`
  - `emailSentAt: <current_timestamp>`
  - `emailError: null` (previous error cleared)
- Audit log entry with action: `EMAIL_RESENT`
- Email is received by the invited user

---

### Scenario 7: Resend Email - Expired Invitation

**Setup:**
- CollaborativeMember exists with `emailSent: false`
- Invitation was created more than 24 hours ago

**Steps:**
1. POST to `/api/collaboration/resend-email` with expired collaboratorId

**Expected Results:**
- HTTP 400 Bad Request
- Response:
  ```json
  {
    "success": false,
    "message": "This invitation has expired. Please create a new invitation."
  }
  ```

---

### Scenario 8: Resend Email - Already Accepted

**Setup:**
- CollaborativeMember exists with `status: "ACCEPTED"`

**Steps:**
1. POST to `/api/collaboration/resend-email`

**Expected Results:**
- HTTP 400 Bad Request
- Response:
  ```json
  {
    "success": false,
    "message": "This invitation has already been accepted."
  }
  ```

---

### Scenario 9: Resend Email - Not Owner

**Setup:**
- CollaborativeMember exists owned by another user

**Steps:**
1. Authenticate as a different user
2. POST to `/api/collaboration/resend-email` with collaboratorId

**Expected Results:**
- HTTP 404 Not Found
- Response:
  ```json
  {
    "success": false,
    "message": "Invitation not found"
  }
  ```

---

### Scenario 10: Audit Log Verification

**Setup:**
- Create invitation and resend email

**Steps:**
1. Query audit logs for the owner

**Expected Results:**
```sql
SELECT action, details, "createdAt"
FROM "CollaborationAuditLog"
WHERE "ownerId" = '<owner_id>'
ORDER BY "createdAt" DESC;
```

**Expected Output:**
- Row 1: action="EMAIL_RESENT", details="Invitation email resent to test@example.com"
- Row 2: action="INVITE_CREATED", details="Invitation sent to test@example.com"

---

## Automated Testing

Create test cases using a testing framework like Jest or directly using curl:

```bash
# Test 1: Successful invitation
curl -X POST http://localhost:3000/api/collaboration/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth_cookie>" \
  -d '{"email":"test@example.com","role":"MEMBER"}'

# Test 2: Check email health
curl -X GET http://localhost:3000/api/collaboration/email-health \
  -H "Cookie: <auth_cookie>"

# Test 3: List members
curl -X GET http://localhost:3000/api/collaboration/members \
  -H "Cookie: <auth_cookie>"

# Test 4: Resend email
curl -X POST http://localhost:3000/api/collaboration/resend-email \
  -H "Content-Type: application/json" \
  -H "Cookie: <auth_cookie>" \
  -d '{"collaboratorId":"<id>"}'
```

## Edge Cases

1. **Inviting yourself:** Should return 400 error
2. **Duplicate invitation:** Should return 400 error
3. **Already a member:** Should return 400 error
4. **Invalid email format:** Should return 400 error
5. **Invalid role:** Should return 400 error
6. **Exceeded collaborator limit:** Should return 400 error
7. **Invalid collaboratorId in resend:** Should return 404 error

## Performance Considerations

- Email sending is asynchronous (doesn't block response)
- Multiple email resend attempts are allowed
- Email status updates are atomic
- Audit logs are written for all actions
