# Mixpanel Analytics Integration

This document describes the Mixpanel analytics integration for tracking user interactions, signups, and feature usage.

## Overview

Mixpanel is integrated into the application to track key user interactions and provide insights into user behavior. The integration uses both client-side and server-side tracking to capture events across the entire user journey.

## Configuration

### Environment Variables

Two environment variables are required for full Mixpanel functionality:

```bash
# Client-side tracking (required for browser events)
NEXT_PUBLIC_MIXPANEL_TOKEN="your-mixpanel-project-token"

# Server-side tracking (required for backend events like signups)
MIXPANEL_SERVICE_SECRET="your-mixpanel-service-secret"
```

**Note:** These are optional. If not configured, tracking will be disabled gracefully without affecting application functionality.

### Getting Your Mixpanel Credentials

1. Sign up for a free Mixpanel account at https://mixpanel.com
2. Create a new project
3. Find your **Project Token** in Project Settings → Project Details
4. Find your **Service Account Secret** in Project Settings → Service Accounts

## Tracked Events

### 1. User Signups

**Event Name:** `User Signup`

**Tracked at:**
- Manual signup: `/api/signup` route
- Google OAuth signup: `authOptions.ts` (customAdapter.createUser)

**Properties:**
- `distinct_id`: User ID
- `signup_method`: "email" or "google"
- `plan`: User's selected plan
- `email`: User's email
- `name`: User's name
- `has_referrer`: Boolean indicating if referred by another user

**User Profile Properties:**
- `$email`: User's email
- `$name`: User's name
- `plan`: User's subscription plan
- `role`: User's role (e.g., "ATHLETIC_DIRECTOR")
- `signup_method`: "email" or "google"
- `signup_date`: ISO timestamp

### 2. Book Demo Button Clicks

**Event Name:** `Book Demo Clicked`

**Tracked at:** `BookDemoButton` component (homepage and onboarding/plans page)

**Properties:**
- `source`: "book_demo_button"
- `calendly_url`: The Calendly URL being opened

### 3. Get Started Button Clicks

**Event Name:** `Get Started Clicked`

**Tracked at:**
- Homepage: `HomePageContent.tsx`
- Onboarding/Plans page: `/onboarding/plans/page.tsx`

**Properties (Homepage):**
- `source`: "homepage"
- `button_location`: "hero"

**Properties (Plans Page):**
- `source`: "onboarding_plans"
- `plan_name`: Name of the selected plan
- `plan_type`: "free_trial" or "paid"
- `billing_interval`: "trial", "monthly", or "annual"
- `price`: Price of the selected plan

### 4. Games Table Actions

#### Create Game Button

**Event Name:** `Create Game Clicked`

**Tracked at:** `GamesTable.tsx` (handleNewGame)

**Properties:**
- `source`: "games_table"
- `action`: "create_game_button"

#### Send Email Button

**Event Name:** `Send Email Clicked`

**Tracked at:** `GamesTable.tsx` (handleSendEmail)

**Properties:**
- `source`: "games_table"
- `action`: "send_email_button"
- `selected_games_count`: Number of games selected

#### Add Columns Button

**Event Name:** `Add Columns Clicked`

**Tracked at:** `GamesTable.tsx` (handleAddColumnsClick)

**Properties:**
- `source`: "games_table"
- `action`: "add_columns_button"
- `current_custom_columns_count`: Current number of custom columns

### 5. Calendar Auto-Sync Toggle

**Event Name:** `Calendar Auto-Sync Toggled`

**Tracked at:** `AutoCalendarSyncToggle.tsx`

**Properties:**
- `source`: "settings_page"
- `feature`: "calendar_auto_sync"
- `enabled`: Boolean indicating if feature was enabled or disabled

### 6. AI Bus Info Toggle

**Event Name:** `AI Bus Info Toggled`

**Tracked at:** `AutoFillToggle.tsx`

**Properties:**
- `source`: "travel_ai_page"
- `feature`: "ai_bus_autofill"
- `enabled`: Boolean indicating if feature was enabled or disabled

## Implementation Details

### Client-Side Tracking

The client-side tracking is handled by `mixpanel.services.ts` which wraps the `mixpanel-browser` library:

```typescript
import { trackEvent } from "@/lib/analytics/mixpanel.services";

// Track an event
trackEvent("Event Name", {
  property1: "value1",
  property2: "value2",
});
```

**Features:**
- Automatic initialization via `MixpanelProvider` in the root layout
- Automatic user identification when user logs in
- Page view tracking
- localStorage persistence

### Server-Side Tracking

Server-side tracking is handled by `mixpanel.server.ts` which wraps the `mixpanel` Node.js library:

```typescript
import { trackServerEvent, identifyServerUser } from "@/lib/analytics/mixpanel.server";

// Track a server-side event
trackServerEvent("Event Name", {
  distinct_id: userId,
  property1: "value1",
});

// Identify a user
identifyServerUser(userId, {
  $email: email,
  $name: name,
});
```

### User Identification

Users are automatically identified when they log in through the `MixpanelProvider` component. This ensures all subsequent events are associated with the correct user profile.

## Mixpanel Dashboard Setup

### Recommended Custom Reports

1. **Signup Funnel:**
   - Homepage visits → Get Started clicks → Plan selection → Signups

2. **Feature Adoption:**
   - Track usage of Calendar Auto-Sync and AI Bus Info features

3. **Games Table Engagement:**
   - Monitor Create Game, Send Email, and Add Columns button clicks

4. **Demo Requests:**
   - Track Book Demo button clicks and conversion rates

### Recommended Cohorts

1. **Free Trial Users:** Users with `plan = "free_trial_plan"`
2. **Paid Users:** Users with paid plans
3. **Google Sign-ups:** Users with `signup_method = "google"`
4. **Email Sign-ups:** Users with `signup_method = "email"`

## Privacy and Compliance

- User IP addresses are not tracked by default
- Users can opt-out of tracking through their browser's Do Not Track setting
- All tracking is optional and fails gracefully if not configured
- User emails are stored in Mixpanel user profiles for identification purposes only

## Troubleshooting

### Events Not Appearing in Mixpanel

1. Verify environment variables are set correctly
2. Check browser console for Mixpanel initialization errors
3. Ensure Mixpanel token is valid and project is active
4. Check that ad-blockers are not blocking Mixpanel requests

### Server-Side Events Not Tracking

1. Verify `MIXPANEL_SERVICE_SECRET` is set correctly
2. Check server logs for Mixpanel errors
3. Ensure service account has proper permissions in Mixpanel project settings

## Testing

To test Mixpanel integration in development:

1. Set up environment variables in `.env.local`
2. Perform actions (signup, button clicks, toggle features)
3. Check Mixpanel dashboard under Events → Live View
4. Verify events appear with correct properties

## Additional Resources

- [Mixpanel Documentation](https://developer.mixpanel.com/docs)
- [Mixpanel JavaScript SDK](https://developer.mixpanel.com/docs/javascript)
- [Mixpanel Node.js SDK](https://developer.mixpanel.com/docs/nodejs)
