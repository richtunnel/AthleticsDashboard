# AI Feature Toggles

This document describes the user-configurable toggles for AI-powered features in the application.

## Overview

Users can enable or disable three AI-powered features from the Settings page (`/dashboard/settings`). Each toggle provides granular control over AI functionality, allowing users to customize their experience based on their needs and preferences.

## Features

### 1. AI-Powered Scheduler

**Database Field:** `aiSchedulerEnabled` (boolean, default: false)

**Description:** Provides intelligent scheduling suggestions and conflict detection for games.

**Capabilities:**
- Suggests optimal dates and times for scheduling games
- Detects conflicts across teams, venues, and time slots
- Considers rest periods between games
- Provides confidence scores and alternative suggestions
- Uses rule-based fallback when OpenAI is not configured

**API Endpoints:**
- `GET /api/user/ai-scheduler` - Fetch current setting
- `PATCH /api/user/ai-scheduler` - Update setting
- `POST /api/games/ai-schedule-suggestions` - Get scheduling suggestions
- `POST /api/games/ai-detect-conflicts` - Detect scheduling conflicts

**UI Components:**
- `AISchedulerToggle` - Settings toggle with info tooltip
- Located in `/src/components/settings/AISchedulerToggle.tsx`

**Service:** `/src/lib/services/scheduler-ai.service.ts`

---

### 2. Enhanced Travel Times (Bus Info)

**Database Field:** `aiTravelTimesEnabled` (boolean, default: false)

**Description:** Calculates accurate travel times considering real-time traffic and weather conditions.

**Capabilities:**
- Real-time traffic data via Google Maps Distance Matrix API
- Weather forecasts via OpenWeather API
- Automatic buffer time calculations
- Safety recommendations based on weather conditions
- Stores recommendations in `TravelRecommendation` model

**API Endpoints:**
- `GET /api/user/ai-travel-times` - Fetch current setting
- `PATCH /api/user/ai-travel-times` - Update setting
- `POST /api/games/travel-enhanced` - Get enhanced travel recommendations
- `POST /api/games/travel-recommendations/apply` - Apply recommendations to game

**UI Components:**
- `AITravelTimesToggle` - Settings toggle with info tooltip
- Located in `/src/components/settings/AITravelTimesToggle.tsx`

**Service:** `/src/lib/services/travel-enhanced.service.ts`

**External APIs:**
- Google Maps Distance Matrix API (traffic data)
- OpenWeather API (weather forecasts)

---

### 3. AI Email Generation

**Database Field:** `aiEmailGenerationEnabled` (boolean, default: false)

**Description:** Automatically generates professional, context-aware emails for game communications.

**Capabilities:**
- Context-aware email generation based on game details
- Multiple email types:
  - Game notifications
  - Schedule updates
  - Travel information
  - Cancellations
  - Reminders
  - Custom messages
- Tone customization (formal, casual, friendly)
- HTML-formatted output
- Multiple content variations
- Email improvement suggestions
- Template-based fallback when OpenAI is not configured

**API Endpoints:**
- `GET /api/user/ai-email-generation` - Fetch current setting
- `PATCH /api/user/ai-email-generation` - Update setting
- `POST /api/games/ai-generate-email` - Generate new email
- `POST /api/games/ai-improve-email` - Improve existing email

**UI Components:**
- `AIEmailGenerationToggle` - Settings toggle with info tooltip
- Located in `/src/components/settings/AIEmailGenerationToggle.tsx`

**Service:** `/src/lib/services/email-ai.service.ts`

---

## Implementation Details

### Database Schema

The toggles are stored in the `User` model in Prisma:

```prisma
model User {
  // ... other fields
  aiSchedulerEnabled         Boolean   @default(false)
  aiTravelTimesEnabled       Boolean   @default(false)
  aiEmailGenerationEnabled   Boolean   @default(false)
  // ... other fields
}
```

**Migration:** `20251115185811_add_ai_feature_toggles`

### Settings Page Integration

All three toggles are displayed in the Settings page under an "AI Features" card:

**File:** `/src/app/dashboard/settings/page.tsx`

**Layout:**
- Card with "AI Features" heading
- Brief description of AI features
- Three toggles separated by dividers
- Each toggle includes an info tooltip icon

### Toggle Component Pattern

All toggle components follow a consistent pattern:

1. **State Management:** TanStack Query for fetching and updating settings
2. **Loading State:** Shows a spinner while fetching initial state
3. **Error Handling:** Displays error alerts if updates fail
4. **Analytics:** Tracks toggle events via Mixpanel
5. **Info Tooltip:** Provides detailed feature explanation on hover

**Common Dependencies:**
```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Switch, FormControlLabel, Alert, CircularProgress, Tooltip, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
```

### API Route Pattern

All AI toggle API routes follow a consistent pattern:

**GET Endpoint:**
- Requires authentication via `requireAuth()`
- Fetches user's current setting from database
- Returns JSON with `success` and feature-specific field

**PATCH Endpoint:**
- Requires authentication via `requireAuth()`
- Validates `enabled` boolean in request body
- Updates user's setting in database
- Returns JSON with `success` and updated value

### Analytics Tracking

Each toggle emits a Mixpanel event when changed:

```typescript
trackEvent("AI Scheduler Toggled", {
  source: "settings_page",
  feature: "ai_scheduler",
  enabled: true/false,
});
```

**Event Names:**
- `AI Scheduler Toggled`
- `AI Travel Times Toggled`
- `AI Email Generation Toggled`

## Environment Variables

AI features require the following environment variables:

```bash
# Required for all AI features
OPENAI_API_KEY="sk-your-openai-api-key"

# Required for Enhanced Travel Times
GOOGLE_MAPS_API_KEY="your-google-maps-key"
OPENWEATHER_API_KEY="your-openweather-key"
```

## User Experience

### Enabling a Feature

1. Navigate to Settings (`/dashboard/settings`)
2. Scroll to "AI Features" card
3. Click the toggle switch for desired feature
4. Info tooltip available by clicking the info icon
5. Toggle state persists immediately to database
6. Feature is now active for the user

### Disabling a Feature

1. Navigate to Settings
2. Click the toggle switch to turn off
3. Feature is immediately disabled
4. Previously generated content remains accessible

## Testing

### Manual Testing Checklist

- [ ] Navigate to `/dashboard/settings`
- [ ] Verify "AI Features" card is visible
- [ ] Verify all three toggles are present
- [ ] Click each toggle and verify state changes
- [ ] Hover over info icons and verify tooltips display
- [ ] Check browser console for any errors
- [ ] Verify Mixpanel events are tracked
- [ ] Refresh page and verify toggle states persist
- [ ] Test with different user accounts

### API Testing

```bash
# Fetch AI Scheduler setting
curl -X GET http://localhost:3000/api/user/ai-scheduler \
  -H "Cookie: next-auth.session-token=..."

# Update AI Scheduler setting
curl -X PATCH http://localhost:3000/api/user/ai-scheduler \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"enabled": true}'
```

## Future Enhancements

Potential improvements for AI feature toggles:

1. **Feature Usage Analytics:** Track how often each AI feature is used when enabled
2. **Smart Defaults:** Enable features automatically based on user behavior
3. **Feature Recommendations:** Suggest enabling features based on use cases
4. **Granular Controls:** Add sub-toggles for specific capabilities within each feature
5. **Usage Limits:** Add rate limiting or quota management for AI features
6. **A/B Testing:** Test different toggle UI patterns and placements
7. **Onboarding:** Add guided tour to introduce AI features to new users

## Related Documentation

- [AI Integrations Overview](./AI_INTEGRATIONS.md)
- [AI Features Quick Reference](./README-AI-FEATURES.md)
- [Mixpanel Integration](./MIXPANEL_INTEGRATION.md)
- [Settings Page](../src/app/dashboard/settings/README.md)

## Troubleshooting

### Toggle doesn't update
- Check browser console for API errors
- Verify database connection is working
- Check Prisma client is up to date (`npx prisma generate`)

### Feature not working despite toggle enabled
- Verify required environment variables are set
- Check API endpoint for feature-specific errors
- Review service logs for OpenAI API issues

### Info tooltip not displaying
- Verify MUI Tooltip component is properly imported
- Check z-index conflicts with other UI elements
- Test in different browsers

## Support

For issues or questions about AI feature toggles:
- Check the [main documentation](../README.md)
- Review [AI Integrations](./AI_INTEGRATIONS.md)
- Submit feedback via the feedback form in the app
