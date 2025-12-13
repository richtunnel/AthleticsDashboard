# OAuth Account Creation Error Fix

## Problem
Users who delete their accounts are unable to create a new account via Google OAuth, receiving the error:
```
error: OAuthCreateAccount
```

## Root Cause
The issue is in `/src/lib/utils/authOptions.ts` in the `createUser` adapter function (lines 19-25):

```typescript
async createUser(user: any) {
  // Check if email is blocked due to recent account deletion (90-day rule)
  const signupCheck = await isSignupBlocked(user.email);
  if (signupCheck.blocked) {
    console.error('[OAuth] Signup blocked for email:', user.email, 'Expires:', signupCheck.expiresAt);
    throw new Error('This email was used for an account that was recently deleted. Please wait before signing up again or contact support.');
  }
  // ...
}
```

**The SignupLog blocking logic was too aggressive:**
1. On Dec 11, 2024, a fix was implemented to ONLY create SignupLog entries for users with failed payments
2. However, SignupLog entries created BEFORE this fix were blocking ALL users, even those without payment issues
3. These old entries had reasons like `"account_deleted"` or `"account_cleanup_cron"` instead of the new reasons with `"_with_failed_payments"` suffix

## Solution

### 1. Admin Endpoints Created

**`/api/admin/fix-signup-blocking`**
- **GET**: Preview SignupLog entries that would be cleared (incorrect entries vs correct entries)
- **POST**: Clear all SignupLog entries that were created with the old logic
- Clears entries with reasons: `"account_deleted"`, `"account_cleanup_cron"`, or `null`
- Keeps entries with reasons: `"account_deleted_with_failed_payments"`, `"account_cleanup_cron_with_failed_payments"`

**`/api/admin/clear-signup-logs`**
- **GET**: View all active SignupLog entries
- **POST**: Clear all SignupLog entries (or specific email if provided in body)
- Useful for emergency clearing if needed

**`/api/admin/check-orphaned-accounts`**
- **GET**: Check for orphaned Account records (accounts without users)
- **POST**: Clean up orphaned Account records
- Useful for debugging cascade delete issues

### 2. Correct Behavior (After Dec 11, 2024 Fix)

The updated logic in `/src/app/api/user/delete-account/route.ts` (lines 46-67):
```typescript
// Create signup log entry ONLY if user has failed payments
const hasFailedPayments = 
  user.subscription?.status === 'PAST_DUE' || 
  user.subscription?.status === 'UNPAID';

if (hasFailedPayments) {
  await createSignupLog({
    email: user.email,
    phone: user.phone,
    deletedUserId: userId,
    reason: 'account_deleted_with_failed_payments', // ✅ New reason
  });
} else {
  console.log('[DeleteAccount] No failed payments, allowing immediate re-signup');
}
```

### 3. How to Fix Affected Users

**Step 1: Preview what will be cleared**
```bash
curl -X GET https://athleticdirectorhub.com/api/admin/fix-signup-blocking
```

**Step 2: Clear incorrect SignupLog entries**
```bash
curl -X POST https://athleticdirectorhub.com/api/admin/fix-signup-blocking
```

This will:
- Clear all SignupLog entries created before the Dec 11 fix
- Allow affected users to sign up again immediately
- Keep SignupLog entries for users with actual failed payments

**Step 3: (Optional) Clear specific email**
```bash
curl -X POST https://athleticdirectorhub.com/api/admin/clear-signup-logs \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Step 4: (Optional) Check for orphaned accounts**
```bash
curl -X GET https://athleticdirectorhub.com/api/admin/check-orphaned-accounts
curl -X POST https://athleticdirectorhub.com/api/admin/check-orphaned-accounts
```

## Expected Behavior After Fix

### Users WITHOUT Failed Payments
1. User deletes account
2. NO SignupLog entry is created
3. User can immediately sign up again with the same email
4. Google OAuth signup works correctly

### Users WITH Failed Payments (PAST_DUE or UNPAID)
1. User deletes account
2. SignupLog entry is created with reason `"account_deleted_with_failed_payments"`
3. User is blocked from re-signing up for 90 days
4. After 90 days, SignupLog entry expires and they can sign up again

## Files Modified/Created

**Created:**
- `/src/app/api/admin/fix-signup-blocking/route.ts` - Main fix endpoint
- `/src/app/api/admin/clear-signup-logs/route.ts` - View/clear signup logs
- `/src/app/api/admin/check-orphaned-accounts/route.ts` - Check for orphaned accounts
- `/OAUTH_CREATEACCOUNT_FIX.md` - This documentation

**Existing (Already Fixed on Dec 11, 2024):**
- `/src/app/api/user/delete-account/route.ts` - Only creates SignupLog for failed payments
- `/src/app/api/cron/account-cleanup/route.ts` - Only creates SignupLog for failed payments
- `/src/lib/services/signup-log.service.ts` - SignupLog service

## Testing

1. **Clear incorrect entries:**
   ```bash
   curl -X POST https://athleticdirectorhub.com/api/admin/fix-signup-blocking
   ```

2. **Verify user can sign up:**
   - Navigate to signup page
   - Click "Sign Up with Google"
   - Should successfully create account (no OAuthCreateAccount error)

3. **Verify correct blocking still works:**
   - Create a user with PAST_DUE subscription
   - Delete their account
   - Try to sign up again → Should be blocked for 90 days ✅

## Security Note

⚠️ **These admin endpoints should be protected with authentication in production:**
- Add authentication middleware to verify admin/super admin role
- OR move endpoints to a secure admin panel
- OR add IP whitelist restriction
- Current implementation is open for emergency fixes

## Migration Path

If you want to add authentication to these endpoints, wrap them with:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... rest of code
}
```
