# GamesTable Signup Default Columns Fix

## Problem
When new users signed up, they only saw **Date** and **Actions** columns in the GamesTable, instead of the intended 5 default columns.

## Solution
Created a background service that initializes column preferences for new users during signup.

## Changes Made

### 1. New Service: `initial-columns.service.ts`
**Location**: `/src/lib/services/initial-columns.service.ts`

Creates default column preferences for new users with only 5 essential columns visible:
- ✅ **Date** - Essential for scheduling
- ✅ **Sport** - What sport is being played
- ✅ **Level** - What level (Varsity, JV, etc.)
- ✅ **Location** - Where the game is
- ✅ **Actions** - Required for CRUD operations

**Hidden by default** (can be revealed via Column Preferences menu):
- Opponent
- Home/Away (isHome)
- Time
- Status
- Bus/Travel
- Notes

### 2. Integration into Manual Signup
**Location**: `/src/app/api/signup/route.ts`

Added non-blocking call to `createInitialColumnPreferences()` after user creation:
```typescript
// Create initial column preferences for new user (non-blocking)
// This ensures they see only the 5 essential columns: Date, Sport, Level, Location, Actions
void createInitialColumnPreferences(user.id).catch((error) => {
  console.error("[Signup] Failed to create initial column preferences:", error);
});
```

### 3. Integration into OAuth Signup
**Location**: `/src/lib/utils/authOptions.ts`

Added non-blocking call to `createInitialColumnPreferences()` in the custom adapter's `createUser` method:
```typescript
// Create initial column preferences for new user (non-blocking)
// This ensures they see only the 5 essential columns: Date, Sport, Level, Location, Actions
void runNonCritical(
  () => createInitialColumnPreferences(newUser.id),
  `initial column preferences for user ${newUser.id}`,
);
```

## Implementation Details

### Non-Blocking Execution
- Column preference creation happens in the background
- Does NOT block user signup or onboarding flow
- Uses `void` promises with error catching
- OAuth signup uses `runNonCritical()` wrapper for consistency

### Database Schema
Uses existing `TablePreference` model:
```typescript
{
  userId: string;
  tableKey: "games";
  preferences: {
    order: ["date", "sport", "level", "location", "actions"],
    hidden: ["opponent", "isHome", "time", "status", "busTravel", "notes"]
  }
}
```

### Safety Checks
- Service checks if preferences already exist before creating
- Graceful error handling with logging
- Never throws errors (non-critical operation)

## User Experience

### Before Fix
New users saw:
- Date
- Actions
- (All other columns were randomly visible/hidden)

### After Fix
New users see:
- Date
- Sport
- Level
- Location
- Actions

### Accessing Hidden Columns
Users can unhide additional columns via:
1. Click "Customize Columns" button in GamesTable
2. Toggle visibility of any column
3. Reorder columns as needed
4. Changes are saved automatically

## Technical Notes

### Timing
- Preferences are created immediately after user record creation
- Runs in parallel with sample game creation
- Does not impact signup API response time

### Compatibility
- Works with both manual signup and Google OAuth signup
- Compatible with existing column preferences system
- Does not affect users who already have preferences
- Safe to run on existing database (idempotent)

## Testing

### Manual Signup Flow
1. User enters email/password
2. Account created → preferences initialized in background
3. User enters school details
4. Redirected to dashboard → sees 5 default columns

### OAuth Signup Flow
1. User clicks "Sign Up with Google"
2. Google OAuth flow
3. Account created → preferences initialized in background
4. Redirected to onboarding details
5. After details → dashboard with 5 default columns

## Future Considerations

### Customizable Defaults
If needed, we can:
- Make default visible columns configurable per organization
- Allow admins to set organizational defaults
- Provide different defaults for different user roles

### Migration
No migration needed - only affects NEW users going forward.

## Files Modified
1. `/src/lib/services/initial-columns.service.ts` - NEW
2. `/src/app/api/signup/route.ts` - Added initialization call
3. `/src/lib/utils/authOptions.ts` - Added initialization call

## Related Features
- Sample Game feature (also runs on signup)
- Column Preferences system
- CSV import with custom columns
