# Password Reset Implementation

This document describes the complete forgot password and password reset flow implementation.

## Overview

A secure password reset flow has been implemented that allows users to reset their password via email. The implementation includes:

- Forgot password page
- Password reset request handling
- Email notifications with reset links
- Password reset page with token validation
- Password strength indicator
- Comprehensive security measures

## Files Created/Modified

### New Files

1. **src/app/(auth)/forgot-password/page.tsx**
   - Client component for forgot password UI
   - Email input form
   - Success/error message handling
   - Link back to login page

2. **src/app/(auth)/forgot-password/actions.ts**
   - Server action for password reset request
   - Email validation
   - Token generation and hashing
   - Rate limiting (3 attempts per 15 minutes)
   - Email sending via Resend

3. **src/app/(auth)/reset-password/page.tsx**
   - Client component for password reset UI
   - Token validation on page load
   - New password and confirm password fields
   - Password strength indicator
   - Show/hide password toggle
   - Success/error message handling

4. **src/app/(auth)/reset-password/actions.ts**
   - Server actions for token validation and password reset
   - Password complexity validation
   - Token expiry checking
   - Password hashing with bcrypt
   - Confirmation email sending

5. **prisma/migrations/20251023002532_add_password_reset_fields/migration.sql**
   - Database migration to add reset token fields

### Modified Files

1. **prisma/schema.prisma**
   - Added `resetToken` and `resetTokenExpiry` fields to User model

2. **src/app/(auth)/login/page.tsx**
   - Added "Forgot password?" link below password field
   - Added success message display for password reset completion

## Database Schema Changes

Added to the `User` model:

```prisma
resetToken        String?
resetTokenExpiry  DateTime?
```

Migration file: `prisma/migrations/20251023002532_add_password_reset_fields/migration.sql`

## User Flow

### Forgot Password Flow

1. User clicks "Forgot password?" link on login page
2. User enters their email address
3. System validates email and checks if user exists
4. If valid, generates secure reset token (32 bytes, hashed with bcrypt)
5. Stores hashed token in database with 1 hour expiry
6. Sends email with reset link containing unhashed token
7. Shows success message (same message whether user exists or not for security)

### Password Reset Flow

1. User clicks reset link from email
2. System validates token and checks expiry
3. If valid, shows password reset form with:
   - New password field with show/hide toggle
   - Confirm password field with show/hide toggle
   - Real-time password strength indicator
4. User enters and confirms new password
5. System validates:
   - Passwords match
   - Minimum 8 characters
   - Contains at least one letter and one number
6. Password is hashed and stored
7. Reset token is cleared from database
8. Confirmation email is sent
9. User is redirected to login with success message

## Security Features

### Token Security

- Tokens are 32-byte random strings (256 bits of entropy)
- Tokens are hashed with bcrypt before storage (same as passwords)
- Tokens expire after 1 hour
- Tokens are single-use (cleared after successful reset)

### Rate Limiting

- Maximum 3 reset attempts per email within 15 minutes
- Prevents brute force attacks and email spam

### Email Enumeration Prevention

- Same success message shown whether user exists or not
- Prevents attackers from discovering valid email addresses

### Password Requirements

- Minimum 8 characters
- Must contain at least one letter
- Must contain at least one number
- Password strength indicator guides users to create strong passwords

### Additional Security

- All database queries use parameterized inputs
- Email addresses are normalized (lowercased and trimmed)
- Google OAuth users without passwords are handled gracefully
- Expired tokens are automatically cleared from database

## Email Templates

### Password Reset Request Email

- Clear subject line: "Reset Your Password - AD Hub"
- Prominent reset button
- Plain text link as alternative
- Expiry warning (1 hour)
- Security notice if user didn't request reset

### Password Reset Confirmation Email

- Subject: "Password Successfully Reset - AD Hub"
- Success confirmation
- Link to sign in
- Security notice to contact support if unauthorized

## Configuration

### Environment Variables

The following environment variables are required:

```env
# Resend email service
NEXT_PUBLIC_RESEND_API_KEY=your_NEXT_PUBLIC_RESEND_API_KEY

# Email sender address
EMAIL_FROM="AD Hub <noreply@athleticdirectorhub.com>"

# Application URL (for reset links)
NEXTAUTH_URL=http://localhost:3000  # or your production URL
```

### Resend Setup

1. Sign up for a Resend account at https://resend.com
2. Get your API key from the dashboard
3. Set up domain verification for production
4. Add NEXT_PUBLIC_RESEND_API_KEY to environment variables

## Testing

### Manual Testing

1. **Forgot Password Flow:**

   ```
   - Go to /login
   - Click "Forgot password?"
   - Enter a valid email
   - Check email for reset link
   - Verify link expires after 1 hour
   ```

2. **Password Reset Flow:**

   ```
   - Click reset link from email
   - Enter new password
   - Verify password strength indicator
   - Confirm password
   - Submit form
   - Verify redirect to login
   - Log in with new password
   ```

3. **Security Tests:**
   ```
   - Try using same reset link twice (should fail)
   - Try expired token (should show error)
   - Try invalid token (should show error)
   - Try 4 reset requests quickly (should rate limit)
   ```

### Edge Cases Handled

- User doesn't exist (same success message)
- User has Google OAuth account without password (same success message)
- Token expired (clear error message, link to request new one)
- Token already used (invalid token message)
- Passwords don't match (validation error)
- Weak password (validation error with requirements)
- Email service failure (error message, token cleared)
- Multiple reset requests (rate limiting)

## UI/UX Features

### Forgot Password Page

- Clean, centered layout matching login page
- Email input with validation
- Loading state during submission
- Success message with clear instructions
- Error messages for failures
- Back to login link
- Link to login page after success

### Reset Password Page

- Token validation with loading state
- Password strength indicator:
  - Visual progress bar
  - Color-coded (red/yellow/green)
  - Strength labels (Weak/Fair/Good/Strong)
- Show/hide password toggles
- Password requirements displayed
- Real-time validation feedback
- Success screen with auto-redirect
- Error screen for invalid tokens with action button

### Login Page Updates

- "Forgot password?" link below password field
- Success alert when redirected after reset
- Maintains existing Google and email login flows

## Password Strength Calculation

The password strength indicator evaluates:

- Length: 8+ chars (25 points), 12+ chars (additional 25 points)
- Mixed case: Both upper and lower (25 points)
- Numbers: Contains digits (15 points)
- Special characters: Contains symbols (10 points)

Strength levels:

- Weak: < 40 points (red)
- Fair: 40-69 points (yellow)
- Good: 70-89 points (green)
- Strong: 90-100 points (green)

## Error Handling

All error scenarios are handled gracefully:

1. **Network errors:** Generic error message, user can retry
2. **Email service errors:** Clear message, token cleaned up
3. **Database errors:** Logged server-side, generic message to user
4. **Validation errors:** Specific, actionable error messages

## Future Enhancements

Potential improvements for future iterations:

1. **Redis-based rate limiting:** Replace in-memory Map with Redis for distributed rate limiting
2. **Email templates:** Use React Email for beautiful, responsive templates
3. **SMS reset option:** Allow password reset via SMS for added security
4. **2FA integration:** Require 2FA verification for password reset
5. **Password history:** Prevent reuse of recent passwords
6. **Account lockout:** Lock account after multiple failed attempts
7. **Admin notifications:** Alert admins of suspicious reset activity

## Maintenance

### Regular Tasks

1. Monitor email delivery rates in Resend dashboard
2. Review rate limiting thresholds if abuse detected
3. Update email templates as branding changes
4. Review password requirements as security standards evolve

### Troubleshooting

**Emails not sending:**

- Check NEXT_PUBLIC_RESEND_API_KEY is set correctly
- Verify domain in Resend dashboard
- Check email service logs for errors

**Rate limiting issues:**

- Clear rate limit: restart server (in-memory store)
- For production: implement Redis-based rate limiting

**Token validation failures:**

- Check system clock synchronization (for expiry)
- Verify database has resetToken and resetTokenExpiry columns

## Dependencies

- **bcryptjs (3.0.2):** Password and token hashing
- **resend (6.2.2):** Email delivery service
- **crypto (built-in):** Secure random token generation
- **@mui/material:** UI components
- **next (15.5.4):** Framework and routing
- **prisma:** Database ORM

## Compliance

This implementation follows security best practices:

- OWASP password reset guidelines
- GDPR compliant (no unnecessary data collection)
- Rate limiting prevents abuse
- Secure token generation and storage
- Email enumeration protection
