# Signup Flow Fixes - Add School Details

## Issues Fixed

### 1. Google API Fallback - Manual Address Entry
**Problem**: If Google Places API fails, users cannot manually enter their school address, blocking the signup flow.

**Solution**: 
- Changed `SchoolAddressAutocomplete` component to use `freeSolo={true}` 
- This allows users to type and submit any address manually if the API fails or returns no results
- Updated helper text and noOptionsText to indicate manual entry is possible
- Component still provides Google Places autocomplete when available, but doesn't require it

**Files Modified**:
- `/src/components/forms/SchoolAddressAutocomplete.tsx`

### 2. Add School Details Step Restored to Signup Flow
**Problem**: After successful signup (both manual and Google OAuth), users were redirected directly to `/dashboard`, skipping the school details step at `/onboarding/details`.

**Solution**:
- Updated manual signup flow to redirect to `/onboarding/details` instead of `/dashboard`
- Updated Google OAuth signup flow to redirect to `/onboarding/details` instead of `/dashboard`
- Added smart redirect logic in `/onboarding/details` page:
  - If user is not authenticated → redirect to `/onboarding/plans`
  - If user already has school details → redirect to `/dashboard` (prevents duplicate entry)
  - Otherwise → show the form to collect school details
- Created new API endpoint `/api/user/profile` to check if user has school details

**Files Modified**:
- `/src/app/onboarding/signup/page.tsx` - Changed callback URLs
- `/src/app/onboarding/details/page.tsx` - Added smart redirect logic
- `/src/app/api/user/profile/route.ts` - New endpoint (created)

## User Flow After Changes

### Manual Signup Flow:
1. User visits `/onboarding/signup?plan=free_trial_plan`
2. User fills in name, email, password and submits
3. User is automatically logged in
4. ✅ User is redirected to `/onboarding/details` ← **NEW**
5. User enters school name, team name, and school address
6. User clicks "Complete Setup"
7. User is redirected to `/dashboard`

### Google OAuth Signup Flow:
1. User visits `/onboarding/signup` and clicks "Sign up with Google"
2. User is redirected to `/onboarding/google-consent`
3. User clicks "Continue with Google"
4. User completes Google OAuth
5. ✅ User is redirected to `/onboarding/details` ← **NEW**
6. User enters school name, team name, and school address
7. User clicks "Complete Setup"
8. User is redirected to `/dashboard`

### Returning User Flow:
1. Existing user tries to access `/onboarding/details`
2. ✅ System checks if they already have school details
3. If yes → redirect to `/dashboard` (no duplicate entry)
4. If no → show the form

## API Changes

### New Endpoint: `GET /api/user/profile`
Returns the current user's profile data including school details:
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "name": "User Name",
  "schoolName": "Example High School",
  "teamName": "Varsity Football",
  "schoolAddress": "123 Main St, City, State 12345"
}
```

**Authentication**: Required (NextAuth session)
**Usage**: Used by `/onboarding/details` to check if user has already completed this step

## Google Places API Resilience

The `SchoolAddressAutocomplete` component now handles API failures gracefully:

### Before:
- API failure → empty dropdown → user stuck
- No option to type manually
- Form submission blocked

### After:
- API failure → user can type address manually
- Autocomplete suggestions shown when API works
- Manual entry always available as fallback
- Helper text guides user: "Start typing or enter address manually"
- No options text: "No addresses found - you can enter manually"

## Testing Checklist

- [x] Build passes without errors
- [ ] Manual signup redirects to `/onboarding/details`
- [ ] Google OAuth signup redirects to `/onboarding/details`
- [ ] School address can be entered manually when Google API is disabled
- [ ] School address autocomplete still works when Google API is enabled
- [ ] Returning users with school details are redirected to dashboard
- [ ] New users without school details see the form
- [ ] Form submission works and redirects to dashboard

## Environment Variables

No new environment variables required. Existing Google Places API keys continue to work:
- `GOOGLE_MAPS_API_KEY` - Used for autocomplete (optional fallback to manual entry)

## Backward Compatibility

✅ All changes are backward compatible:
- Users who already have school details are not affected
- Manual address entry doesn't break autocomplete functionality
- Existing API endpoints continue to work
- No database schema changes required

## Related Files

### Components:
- `/src/components/forms/SchoolAddressAutocomplete.tsx` - Address input with Google Places
- `/src/components/auth/AuthActionButton.tsx` - Used for form submission

### Pages:
- `/src/app/onboarding/signup/page.tsx` - Manual signup
- `/src/app/onboarding/google-consent/page.tsx` - Google OAuth consent
- `/src/app/onboarding/details/page.tsx` - School details form

### API Routes:
- `/src/app/api/user/update/route.ts` - Updates user profile (existing)
- `/src/app/api/user/profile/route.ts` - Gets user profile (new)
- `/src/app/api/google-places/autocomplete/route.ts` - Google Places autocomplete (existing)
- `/src/app/api/google-places/details/route.ts` - Google Places details (existing)

### Auth Configuration:
- `/src/lib/utils/authOptions.ts` - NextAuth configuration (no changes needed)
