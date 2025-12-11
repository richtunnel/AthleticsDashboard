# Google OAuth Signup Prompt Fix

## Problem
When users signed up with Google OAuth (whether new users or users who previously deleted their account), Google's OAuth screen displayed "Sign back into sitename" instead of a clear account selection/creation flow. This created confusion about whether they were signing in or signing up, even though the signup technically succeeded.

## Root Cause
The NextAuth Google provider configuration had `prompt: "consent"` hardcoded in the authorization parameters (line 150 of `/src/lib/utils/authOptions.ts`). This parameter forces Google to show re-consent messaging with the "Sign back into..." text, regardless of whether the user is new or existing.

### What `prompt: "consent"` does:
- Forces the user to re-consent to OAuth permissions
- Always shows "Sign back into [sitename]" messaging
- Confusing for genuinely new users during signup
- Doesn't differentiate between signup and login flows

## Solution
Changed the `prompt` parameter from `"consent"` to `"select_account"` in the Google provider authorization configuration.

### What `prompt: "select_account"` does:
- Shows Google's standard account picker interface
- Allows users to select from existing accounts OR create a new Google account
- Provides a cleaner, more intuitive experience
- Works well for both signup and login flows
- Google automatically handles the appropriate messaging based on user state

### File Modified
**`/src/lib/utils/authOptions.ts`** (line 150)

**Before:**
```typescript
authorization: {
  params: {
    prompt: "consent",  // ❌ Forces re-consent, confusing "Sign back into" message
    access_type: "offline",
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  },
}
```

**After:**
```typescript
authorization: {
  params: {
    prompt: "select_account",  // ✅ Shows account picker, cleaner UX
    access_type: "offline",
    response_type: "code",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  },
}
```

## Benefits
1. **Clearer UX**: Users see Google's standard account picker instead of confusing "Sign back into" messaging
2. **Unified Experience**: Same flow works well for both signup and login
3. **Professional**: Uses Google's recommended pattern for account selection
4. **Maintains Functionality**: Still gets refresh tokens via `access_type: "offline"`
5. **No Breaking Changes**: Existing users continue to authenticate normally

## Impact
- **Signup Flow**: New users now see a clear account selection screen where they can choose to use an existing Google account or create a new one
- **Login Flow**: Existing users see the same familiar account picker (works identically to before)
- **User Experience**: Eliminates confusion about whether the user is signing in or signing up

## User Experience

### Before Fix (with `prompt: "consent"`)
1. User clicks "Sign up with Google"
2. Google shows: "Sign back into [sitename]" ❌ (confusing for new users)
3. User proceeds with confusion about whether they're signing in or signing up

### After Fix (with `prompt: "select_account"`)
1. User clicks "Sign up with Google"
2. Google shows: "Choose an account" or "Sign in with Google" ✅ (clear and intuitive)
3. User selects existing account or can create new Google account
4. Clean, professional OAuth experience

## Testing Recommendations
1. **New User Signup**: Verify Google shows appropriate account selection screen
2. **Existing User Login**: Verify existing users can still sign in normally
3. **Previously Deleted Account**: Verify re-signup works correctly
4. **Multiple Accounts**: Verify users can choose between multiple Google accounts
5. **Cross-Browser**: Test in Chrome, Safari, Firefox, Edge

## Related Documentation
- Google OAuth 2.0 Prompt Parameter: https://developers.google.com/identity/protocols/oauth2/openid-connect#prompt
- NextAuth.js Google Provider: https://next-auth.js.org/providers/google
- Existing Signup Flow Fix (Dec 11, 2024): See memory for details on login vs signup flow separation

## Date
December 11, 2024
