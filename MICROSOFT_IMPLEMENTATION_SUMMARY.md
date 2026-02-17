# Microsoft/Outlook Integration Implementation Summary

## Changes Made

### 1. Database Schema (prisma/schema.prisma)
- Added Microsoft token fields to `User` model:
  - `microsoftCalendarRefreshToken` - Stores refresh token for token renewal
  - `microsoftCalendarAccessToken` - Stores current access token
  - `microsoftCalendarTokenExpiry` - Tracks when access token expires
  - `microsoftCalendarId` - Stores user's primary calendar ID
  - `microsoftCalendarEmail` - Stores user's Microsoft email
- Added Microsoft event tracking to `Game` model:
  - `microsoftCalendarEventId` - ID of event in Microsoft calendar
  - `microsoftCalendarWebLink` - Link to view event in Outlook
- Added Microsoft calendar fields to `CalendarGroupMapping` model:
  - `microsoftCalendarId` - Microsoft calendar ID for group mappings
  - `microsoftCalendarName` - Display name of Microsoft calendar

### 2. Environment Variables (.env.example)
Added Microsoft OAuth configuration:
- `MICROSOFT_CALENDAR_CLIENT_ID` - Microsoft App Registration Client ID
- `MICROSOFT_CALENDAR_CLIENT_SECRET` - Microsoft App Registration Client Secret
- `MICROSOFT_CALENDAR_TENANT_ID` - Azure tenant ID (or "common" for multi-tenant)
- `MICROSOFT_REDIRECT_URI` - OAuth callback URL

### 3. TypeScript Types (types/next-auth.d.ts)
Extended NextAuth types to include Microsoft calendar tokens in:
- `Session` interface
- `User` interface
- `JWT` interface

### 4. Authentication Configuration (src/lib/utils/authOptions.ts)
- Added `AzureADProvider` from next-auth/providers/azure-ad
- Updated `signIn` callback to handle Microsoft provider token storage
- Updated `jwt` callback to manage Microsoft tokens
- Updated `session` callback to expose Microsoft tokens
- Added Microsoft token handling to all credential providers

### 5. Microsoft Library (src/lib/microsoft/)
Created three new service files:

#### auth.ts
- Token refresh logic using Microsoft OAuth endpoints
- Access token validation and renewal
- Helper function for making authenticated Microsoft Graph API requests
- Token revocation for disconnecting

#### microsoft-calendar-sync.ts
- Full calendar sync implementation mirroring Google's functionality
- Event creation with game details (subject, body, location, time)
- Event updates when game details change
- Event deletion from calendar
- Calendar group mapping support for syncing to different calendars
- Smart field extraction from custom fields (Team, Opponent, Sport, Level)
- Comprehensive event descriptions with travel information

#### incremental-auth.service.ts
- Incremental authorization flow for requesting calendar permissions
- OAuth callback handling
- Scope management (check, grant, revoke)
- State token management for CSRF protection

### 6. API Routes (src/app/api/auth/microsoft-calendar/)
Created four API endpoints:

#### connect/route.ts (POST)
- Initiates OAuth flow for calendar permissions
- Generates authorization URL
- Returns URL for frontend to redirect user

#### callback/route.ts (GET)
- Handles OAuth callback from Microsoft
- Exchanges authorization code for tokens
- Stores tokens in database
- Redirects user back to application

#### status/route.ts (GET)
- Checks if user has connected Microsoft Calendar
- Returns connection status and granted scopes

#### disconnect/route.ts (POST)
- Revokes calendar permissions
- Clears tokens from database
- Removes Microsoft calendar event IDs from games

### 7. React Hooks (src/hooks/)
Created useMicrosoftCalendarConnection.ts:
- Query connection status
- Initiate connection flow
- Disconnect calendar
- Auto-refetch after mutations
- Manage loading states

### 8. React Components (src/components/auth/)
Created two new components:

#### ConnectMicrosoftCalendarButton.tsx
- Reusable button for connecting Microsoft Calendar
- Shows different states (connected, loading, disconnected)
- Tooltip with status information
- Opens connection dialog on click

#### ConnectMicrosoftCalendarDialog.tsx
- Explains permissions being requested
- Lists what the app can do with calendar access
- Privacy and security information
- Handles connection flow with loading states

### 9. Authentication Pages

#### /signup page (src/app/(auth)/signup/page.tsx)
- Added Microsoft icon component (4-quadrant colored logo)
- Added Microsoft sign-up button
- Added Microsoft auth state management
- Shows both Google and Microsoft sign-up options

#### /login page (src/app/(auth)/login/page.tsx)
- Added Microsoft icon component
- Added Microsoft sign-in button
- Added Microsoft auth state management
- Shows both Google and Microsoft sign-in options

### 10. Documentation
Created MICROSOFT_INTEGRATION.md with:
- Feature overview
- Database schema changes
- Environment variable configuration
- API endpoint documentation
- Component documentation
- Usage examples
- Security considerations
- Testing guidelines
- Troubleshooting tips

## Key Features

1. **Full OAuth Flow**: Complete Microsoft OAuth 2.0 implementation with Azure AD
2. **Incremental Authorization**: Request calendar permissions separately on-demand
3. **Automatic Token Refresh**: Seamless token renewal before expiry
4. **Calendar Group Mappings**: Sync different game types to different calendars
5. **Event Management**: Create, update, and delete calendar events
6. **Smart Field Extraction**: Extract team/opponent info from custom fields
7. **Comprehensive Event Details**: Include sport, level, teams, status, and travel info
8. **Error Handling**: Robust error handling with user-friendly messages
9. **Security**: CSRF protection, secure token storage, OAuth state verification
10. **Mirror Google Implementation**: Consistent with existing Google integration

## Integration Points

The Microsoft integration mirrors the Google integration:

- Same database schema pattern (token fields, event IDs, group mappings)
- Same API structure (connect, callback, status, disconnect)
- Same component structure (button, dialog, hook)
- Same calendar sync logic (create, update, delete, group mappings)
- Same user experience (sign-in/up, calendar connection)

## Files Created
- src/lib/microsoft/auth.ts
- src/lib/microsoft/microsoft-calendar-sync.ts
- src/lib/microsoft/incremental-auth.service.ts
- src/app/api/auth/microsoft-calendar/connect/route.ts
- src/app/api/auth/microsoft-calendar/callback/route.ts
- src/app/api/auth/microsoft-calendar/status/route.ts
- src/app/api/auth/microsoft-calendar/disconnect/route.ts
- src/hooks/useMicrosoftCalendarConnection.ts
- src/components/auth/ConnectMicrosoftCalendarButton.tsx
- src/components/auth/ConnectMicrosoftCalendarDialog.tsx
- MICROSOFT_INTEGRATION.md
- MICROSOFT_IMPLEMENTATION_SUMMARY.md

## Files Modified
- prisma/schema.prisma
- .env.example
- types/next-auth.d.ts
- src/lib/utils/authOptions.ts
- src/app/(auth)/signup/page.tsx
- src/app/(auth)/login/page.tsx

## Next Steps for Users

1. Create Microsoft App Registration in Azure Portal
2. Configure redirect URIs
3. Set environment variables
4. Run database migration
5. Test sign-up/sign-in flow
6. Test calendar sync

## Migration Command

```bash
npx prisma migrate dev --name add_microsoft_calendar_support
```
