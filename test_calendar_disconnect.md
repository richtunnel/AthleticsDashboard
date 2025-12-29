# Calendar Disconnect Fix Verification

## Problem
Clicking "Disconnect Calendar" in gsync or settings does not disconnect the user's calendar.

## Root Cause
- GoogleCalendarSyncMenu was calling `/api/user/calendar-disconnect` 
- This endpoint only cleared `googleCalendarRefreshToken`
- Status check considers user connected if they have EITHER:
  - CALENDAR scopes in Account.scope
  - Legacy tokens (googleCalendarAccessToken OR googleCalendarRefreshToken)
- Result: Calendar still shows as connected after disconnect

## Solution

### 1. Updated GoogleCalendarSyncMenu.tsx
Changed from:
```typescript
await fetch("/api/user/calendar-disconnect", { method: "POST" });
```

To:
```typescript
await fetch("/api/auth/google-calendar/disconnect", { method: "POST" });
```

### 2. Enhanced Legacy Endpoint (Backward Compatibility)
Updated `/api/user/calendar-disconnect/route.ts` to use the same logic as the proper endpoint:
- Calls `revokeScopes(session.user.id, "CALENDAR")`
- Clears ALL calendar tokens
- Falls back to clearing legacy tokens if needed

## How It Works Now

### Proper Disconnect Flow
1. User clicks "Disconnect Calendar"
2. Calls `/api/auth/google-calendar/disconnect`
3. `revokeScopes()` removes CALENDAR scopes from Account.scope
4. Clears ALL calendar tokens from User table
5. Status check returns `connected: false`
6. UI updates to show calendar as disconnected ✅

### Status Check Logic
```typescript
// /api/auth/google-calendar/status/route.ts
const hasCalendarScope = await hasScopes(session.user.id, "CALENDAR");
const hasLegacyTokens = Boolean(userTokens?.googleCalendarRefreshToken || userTokens?.googleCalendarAccessToken);

return NextResponse.json({
  connected: hasCalendarScope || hasLegacyTokens, // Now returns false after proper disconnect
  scopes: normalizedScopes,
});
```

## Files Modified
1. `/src/components/calendar/GoogleCalendarSyncMenu.tsx` - Line 72
2. `/src/app/api/user/calendar-disconnect/route.ts` - Complete rewrite

## Verification
- Settings page disconnect: ✅ (already used correct endpoint via hook)
- GoogleCalendarSyncMenu disconnect: ✅ (now uses correct endpoint)
- Legacy endpoint: ✅ (updated for backward compatibility)
- Status consistency: ✅ (both pages will show same connection state)
