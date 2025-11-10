# Mixpanel Tracking Implementation

This document describes the Mixpanel analytics tracking implementation for the Athletic Directors Hub application.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
NEXT_PUBLIC_MIXPANEL_TOKEN=your_mixpanel_project_token
MIXPANEL_SERVICE_SECRET=your_mixpanel_service_secret
```

- `NEXT_PUBLIC_MIXPANEL_TOKEN`: Your Mixpanel project token (used for client-side tracking)
- `MIXPANEL_SERVICE_SECRET`: Your Mixpanel API secret (used for server-side tracking)

## Features Tracked

### 1. User Signups

**Event Name:** `User Signup`

**Properties:**
- `distinct_id`: User ID
- `email`: User email
- `name`: User name
- `plan`: Plan selected (e.g., "free_trial_plan", "directors_plan")
- `signup_method`: "manual" or "google"
- `has_referrer`: Boolean indicating if signup included a referrer

**Tracked in:**
- `/src/app/api/signup/route.ts` (manual signup)
- `/src/lib/utils/authOptions.ts` (Google signup)

### 2. Book a Demo Button Clicks

**Event Name:** `Book Demo Clicked`

**Properties:**
- `source`: Location where button was clicked (e.g., "homepage_header", "plans_page")
- `calendly_url`: The Calendly URL being opened

**Tracked in:**
- `/src/components/buttons/BookDemoButton.tsx`

**Button Locations:**
- Homepage header
- Onboarding plans page

### 3. Get Started Button Clicks

**Event Name:** `Get Started Clicked`

**Properties:**
- `source`: Location of button (e.g., "homepage", "plans_page")
- `user_status`: "authenticated" or "unauthenticated"
- `plan_name`: Plan name (only on plans page)
- `plan_type`: "free" or billing cycle (only on plans page)
- `plan_price`: Selected price (only on plans page)

**Tracked in:**
- `/src/components/home/HomePageContent.tsx` (homepage)
- `/src/app/onboarding/plans/page.tsx` (plans page)

### 4. GamesTable Button Clicks

#### Create Game Button
**Event Name:** `Create Game Clicked`

**Properties:**
- `source`: "games_table"

#### Send Email Button
**Event Name:** `Send Email Clicked`

**Properties:**
- `source`: "games_table"
- `games_selected`: Number of games selected

#### Add Columns Button
**Event Name:** `Add Columns Clicked`

**Properties:**
- `source`: "games_table"
- `custom_columns_count`: Number of custom columns

**Tracked in:**
- `/src/components/games/GamesTable.tsx`

### 5. Calendar Auto-Sync Toggle

**Event Name:** `Calendar Auto-Sync Toggled`

**Properties:**
- `enabled`: Boolean indicating new state
- `source`: "settings"

**Tracked in:**
- `/src/components/settings/AutoCalendarSyncToggle.tsx`

### 6. AI Bus Info Toggle

**Event Name:** `AI Bus Info Toggle Changed`

**Properties:**
- `enabled`: Boolean indicating new state
- `source`: "travel_settings"

**Tracked in:**
- `/src/components/travel/AutoFillToggle.tsx`

## User Identification

Users are automatically identified in Mixpanel when they authenticate. The identification happens in:
- `/src/components/analytics/MixpanelIdentifier.tsx`

**User Properties Set:**
- `$email`: User email
- `$name`: User name
- `role`: User role
- `organization_id`: Organization ID

## Implementation Details

### Client-Side Tracking

Client-side tracking uses `mixpanel-browser` and is configured in:
- `/src/lib/analytics/mixpanel.services.ts`

**Functions:**
- `initMixpanel()`: Initialize Mixpanel with configuration
- `trackEvent(event, properties)`: Track an event
- `identifyUser(userId, userProperties)`: Identify a user
- `setUserProperties(properties)`: Set user properties

**Configuration:**
- Debug mode enabled in development
- Page view tracking enabled
- Autocapture enabled
- Session recording at 100% (configurable)

### Server-Side Tracking

Server-side tracking uses the `mixpanel` Node.js SDK and is configured in:
- `/src/lib/analytics/mixpanel.server.ts`

**Functions:**
- `trackServerEvent(event, properties)`: Track server-side events

**Used for:**
- User signups (both manual and Google)
- Any server-side action that needs tracking

### Initialization

Mixpanel is initialized in the root layout:
- `/src/app/layout.tsx`

User identification happens automatically via:
- `/src/components/analytics/MixpanelIdentifier.tsx` (included in Providers)

## Testing

1. **In Development:**
   - Check browser console for Mixpanel debug messages
   - Events will appear in your Mixpanel project's live view

2. **Verify Tracking:**
   - Sign up with a new account
   - Click Book Demo button
   - Click Get Started button
   - Use GamesTable buttons (Create Game, Send Email, Add Columns)
   - Toggle Calendar Auto-Sync
   - Toggle AI Bus Info

3. **Check Mixpanel Dashboard:**
   - Go to your Mixpanel project
   - Check "Live View" to see real-time events
   - Check "Insights" to analyze event data
   - Check "Funnels" to track user journeys
   - Check "Retention" to see user engagement

## Heatmaps and Session Replay

With the current configuration:
- **Session Recording:** 100% of sessions are recorded (configurable via `record_sessions_percent`)
- **Autocapture:** Automatically captures clicks and form submissions
- **Page Views:** Automatically tracked

To view recordings:
1. Go to your Mixpanel project
2. Navigate to "Session Replay"
3. Filter by user properties or events
4. Watch recordings to understand user behavior

## Privacy Considerations

- User emails and names are tracked for identification
- Session recordings include user interactions
- Ensure compliance with privacy regulations (GDPR, CCPA, etc.)
- Consider adding user consent mechanisms if required

## Troubleshooting

### Events Not Appearing

1. Check environment variables are set correctly
2. Verify Mixpanel token is valid
3. Check browser console for errors
4. Ensure Mixpanel is not blocked by ad blockers

### User Not Identified

1. Verify user is authenticated
2. Check MixpanelIdentifier is rendered
3. Check console for identification errors

### Server-Side Events Missing

1. Verify `MIXPANEL_SERVICE_SECRET` is set
2. Check server logs for errors
3. Ensure API routes have tracking code

## Best Practices

1. **Event Naming:** Use clear, descriptive event names
2. **Properties:** Include relevant context in event properties
3. **Consistency:** Maintain consistent naming conventions
4. **Documentation:** Keep this document updated when adding new events
5. **Testing:** Test all tracking before deploying to production
6. **Privacy:** Be transparent about data collection in your privacy policy
