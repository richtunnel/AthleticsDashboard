# Microsoft/Outlook Integration

This document describes the Microsoft/Outlook authentication and calendar sync integration added to AthleticsDashboard.

## Overview

Users can now:
1. Sign up and sign in using their Microsoft/Outlook account
2. Sync games schedule to their Microsoft Outlook calendar

## Features Implemented

### 1. Microsoft Authentication

- **Sign Up/Sign In**: Users can create accounts and sign in using their Microsoft/Outlook credentials
- **OAuth 2.0**: Uses Microsoft Azure AD OAuth 2.0 for secure authentication
- **Incremental Authorization**: Calendar permissions are requested separately on-demand

### 2. Microsoft Outlook Calendar Sync

- **Game Sync**: Automatically sync scheduled games to Microsoft Outlook calendar
- **Event Creation**: Creates calendar events with game details (teams, location, time, etc.)
- **Event Updates**: Updates existing events when game details change
- **Event Deletion**: Removes events when games are deleted
- **Calendar Group Mappings**: Supports syncing to different calendars based on game attributes (sport, level, team, etc.)

## Database Schema Changes

### User Model
Added the following fields to the `User` model:
```prisma
microsoftCalendarRefreshToken String? @db.Text
microsoftCalendarAccessToken  String? @db.Text
microsoftCalendarTokenExpiry DateTime?
microsoftCalendarId        String?
microsoftCalendarEmail     String?
```

### Game Model
Added the following fields to the `Game` model:
```prisma
microsoftCalendarEventId String?
microsoftCalendarWebLink  String?
```

### CalendarGroupMapping Model
Added the following fields to the `CalendarGroupMapping` model:
```prisma
microsoftCalendarId String?
microsoftCalendarName String?
```

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Microsoft OAuth & Outlook Calendar Integration
MICROSOFT_CALENDAR_CLIENT_ID="your-microsoft-client-id"
MICROSOFT_CALENDAR_CLIENT_SECRET="your-microsoft-client-secret"
MICROSOFT_CALENDAR_TENANT_ID="your-tenant-id-or-common"
MICROSOFT_REDIRECT_URI="http://localhost:3000/api/auth/microsoft-calendar/callback"
```

### Getting Microsoft Credentials

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create a new App Registration
3. Set redirect URI to: `https://your-domain.com/api/auth/microsoft-calendar/callback`
4. Configure permissions:
   - `User.Read` (for profile and email)
   - `Calendars.ReadWrite` (for calendar sync)
5. Copy Client ID and Client Secret
6. For Tenant ID:
   - Use `common` for multi-tenant (any Microsoft account)
   - Use your organization's tenant ID for single-tenant

## API Endpoints

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth handler (includes Microsoft provider)

### Microsoft Calendar
- `POST /api/auth/microsoft-calendar/connect` - Initiate OAuth flow
- `GET /api/auth/microsoft-calendar/callback` - Handle OAuth callback
- `GET /api/auth/microsoft-calendar/status` - Check connection status
- `POST /api/auth/microsoft-calendar/disconnect` - Disconnect calendar

### Calendar Sync
- `POST /api/games/[id]/msync-calendar` - Sync a game to Microsoft calendar
- `DELETE /api/games/[id]/msync-calendar` - Remove a game from Microsoft calendar

## Components

### React Components

#### Auth Components
- `ConnectMicrosoftCalendarButton` - Button to connect Microsoft calendar
- `ConnectMicrosoftCalendarDialog` - Dialog explaining permissions

#### Sign In/Up Pages
- Updated `/login` page with Microsoft sign-in button
- Updated `/signup` page with Microsoft sign-up button

### Hooks

- `useMicrosoftCalendarConnection()` - Hook for managing Microsoft calendar connection state

### Services

- `src/lib/microsoft/auth.ts` - Microsoft OAuth token management
- `src/lib/microsoft/microsoft-calendar-sync.ts` - Calendar sync logic
- `src/lib/microsoft/incremental-auth.service.ts` - Incremental authorization service

## Usage

### Connecting Microsoft Calendar

1. User clicks "Connect Microsoft Calendar" button
2. Dialog explains what permissions are needed
3. User is redirected to Microsoft to authorize
4. Upon authorization, tokens are stored and calendar is connected

### Syncing Games to Calendar

Games can be synced to Microsoft calendar in two ways:

1. **Manual Sync**: Use the sync button on individual games
2. **Auto Sync**: Enable auto-sync to automatically sync when games are created/updated

```typescript
import { syncGameToMicrosoftCalendar } from '@/lib/microsoft/microsoft-calendar-sync';

await syncGameToMicrosoftCalendar(gameId, userId);
```

### Disconnecting

Users can disconnect their Microsoft calendar at any time. This:
- Revokes calendar permissions
- Clears stored tokens
- Removes links to calendar events (but keeps the events in the calendar)

## Token Refresh

The implementation automatically handles token refresh:
- Access tokens expire after 1 hour
- Refresh tokens are used to obtain new access tokens
- Tokens are refreshed when they're close to expiry (5 minute buffer)

## Event Details

Calendar events created by the sync include:

- **Subject**: Team names (e.g., "Varsity Basketball vs Lincoln High")
- **Body**: Game details including sport, level, teams, status, and travel information
- **Location**: Venue name and address
- **Start/End**: Game date and time (2-hour duration by default)
- **Reminders**: Email reminder 24 hours before, popup reminder 1 hour before

## Security

- All tokens are encrypted and stored securely
- Refresh tokens are only used server-side
- Access tokens are never exposed to the client
- OAuth state tokens prevent CSRF attacks
- Tokens are automatically cleared on disconnect

## Testing

### Local Development

1. Set up a Microsoft App Registration in Azure Portal
2. Add `http://localhost:3000/api/auth/microsoft-calendar/callback` to redirect URIs
3. Set environment variables in `.env.local`
4. Test sign-up/sign-in flow
5. Test calendar sync with sample games

### Testing Token Refresh

1. Manually expire an access token in the database
2. Try to sync a game
3. Verify that a new access token is obtained automatically

## Troubleshooting

### Common Issues

1. **"Microsoft account not connected" error**
   - User hasn't completed the OAuth flow
   - Tokens have been revoked
   - Solution: Reconnect calendar using the connect button

2. **"Failed to refresh access token" error**
   - Refresh token has expired (rare, refresh tokens are long-lived)
   - Microsoft app credentials are invalid
   - Solution: User needs to re-authorize

3. **"404 ResourceNotFound" when syncing**
   - Calendar event was deleted from Outlook
   - Solution: Re-sync the game to create a new event

## Migration

To apply the database schema changes:

```bash
# Generate Prisma client
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name add_microsoft_calendar_support
```

## Future Enhancements

Potential future improvements:
- Support for multiple Microsoft calendars
- Sync with other Microsoft services (Tasks, etc.)
- Two-way sync (changes in Outlook update games)
- Batch sync for multiple games
- Calendar conflict detection
