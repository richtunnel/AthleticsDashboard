# Travel AI Implementation Guide

## Overview
The Travel AI system provides AI-powered bus travel recommendations for games, leveraging real-time traffic data from Google Maps Distance Matrix API and weather conditions from OpenWeatherMap API.

## Features Implemented

### 1. Database Schema
- **Game Model**: Added fields for AI travel recommendations
  - `recommendedDepartureTime`: DateTime?
  - `recommendedArrivalTime`: DateTime?
  - `actualDepartureTime`: DateTime?
  - `actualArrivalTime`: DateTime?
  - `travelTimeMinutes`: Int?
  - `autoFillBusInfo`: Boolean (default: false)

- **TravelRecommendation Model**: Tracks AI-generated recommendations
  - Stores departure/arrival times
  - Records traffic and weather conditions
  - Tracks when recommendations are added to games
  - Auto-cleanup after 30 minutes

- **TravelSettings Model**: Organization-level settings
  - `autoFillEnabled`: Toggle for automatic recommendations
  - `defaultBufferMinutes`: Configurable arrival buffer (default: 45 min)
  - `busLoadingMinutes`: Configurable loading time (default: 15 min)

### 2. API Integrations

#### Google Maps Distance Matrix API
- File: `src/lib/api/googleMaps.ts`
- Calculates travel time with real-time traffic
- Returns traffic conditions (light/moderate/heavy)
- Handles route failures gracefully

#### OpenWeatherMap API
- File: `src/lib/api/openWeather.ts`
- Fetches weather conditions for game locations
- Uses coordinates from venue data
- Provides weather descriptions

### 3. Service Layer

#### Travel AI Service
- File: `src/lib/services/travelAI.ts`
- Main business logic for generating recommendations
- Calculates optimal departure times based on:
  - Game time
  - Travel distance with traffic
  - Arrival buffer time
  - Bus loading time
  - Weather conditions
- Batch processing for multiple games
- Auto-cleanup of expired recommendations

### 4. Server Actions
- File: `src/app/dashboard/travel-ai/actions.ts`
- `generateRecommendation(gameId)`: Generate for single game
- `generateBatchRecommendations(gameIds[])`: Generate for multiple games
- `addRecommendationToGame(gameId, recommendationId)`: Apply recommendation
- `undoRecommendation(gameId)`: Remove recommendation
- `toggleAutoFill(enabled)`: Enable/disable auto-fill
- `cleanupExpiredRecommendations()`: Remove old recommendations

### 5. API Endpoints

#### `/api/travel-recommendations`
- GET: Fetch all recommendations for organization
- Filters by added/not added status
- Returns recommendations with full game details

#### `/api/travel-settings`
- GET: Fetch or create default settings for organization
- Uses upsert pattern for first-time access

#### `/api/games`
- Enhanced with `travelRequired` filter parameter
- Supports filtering games that need travel recommendations

### 6. UI Components

#### Travel AI Page (`src/app/dashboard/travel-ai/page.tsx`)
- Main interface for managing recommendations
- Auto-fill toggle section
- Recommendations list with cards
- Generate all button for batch processing
- Cleanup expired recommendations

#### AutoFillToggle (`src/components/travel/AutoFillToggle.tsx`)
- Toggle switch for auto-fill feature
- Save preferences to organization settings
- Shows current status and feedback

#### RecommendationCard (`src/components/travel/RecommendationCard.tsx`)
- Pill-styled card design
- Displays game details (opponent, date, time, venue)
- Shows departure/arrival times
- Traffic and weather indicators
- Add/Undo functionality
- 30-minute countdown timer for auto-removal
- Color-coded traffic conditions

### 7. Navigation
- Added "Travel AI" menu item in dashboard layout
- Uses DepartureBoardIcon from Material UI
- Accessible at `/dashboard/travel-ai`

## Recommendation Logic

### Time Calculation Flow
1. **Start with game time**: Parse game date and time
2. **Calculate arrival time**: Game time - arrival buffer (45 min default)
3. **Estimate departure**: Arrival time - estimated travel time (60 min estimate)
4. **Get actual travel time**: Query Google Maps with departure time for traffic
5. **Calculate final departure**: Arrival time - actual travel time - loading time (15 min)

### Factors Considered
- **Real-time traffic**: Uses Google Maps traffic data
- **Weather conditions**: Fetches forecast for game location
- **Configurable buffers**: Organization can adjust timings
- **Bus loading time**: Accounts for pre-departure prep

## Environment Variables Required

```env
# Google Maps API (required for travel time)
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"

# OpenWeatherMap API (optional, for weather data)
OPENWEATHER_API_KEY="your-openweather-api-key"
```

## Database Migration

Run the migration to add new tables and fields:
```bash
npx prisma migrate deploy
```

Migration file: `prisma/migrations/20251023160000_add_travel_ai/migration.sql`

## Usage Flow

### For Athletic Directors:
1. Navigate to Travel AI page from dashboard
2. Toggle auto-fill if desired (applies to new games)
3. Click "Generate All" to create recommendations for existing games
4. Review each recommendation card
5. Click "Add to Spreadsheet" to apply recommendation to game
6. Undo within 30 minutes if needed
7. Recommendations auto-expire and clean up after 30 minutes

### For Developers:
- Recommendations use the existing Game model's `departureTime` field
- Original `estimatedTravelTime` field preserved for backward compatibility
- New fields provide more granular tracking
- Service layer handles all API integrations with fallbacks

## Error Handling
- API failures return default estimates (60 min travel time)
- Weather failures show "Unknown" condition
- All errors logged to console for debugging
- User-friendly error messages displayed in UI

## Future Enhancements
- Auto-generate on game creation when auto-fill enabled
- Email notifications for recommendations
- Historical traffic pattern analysis
- Integration with school calendar for scheduling conflicts
- Weather alerts for severe conditions
- Route optimization for multiple game venues

## Testing Checklist
- [x] Schema migration runs successfully
- [x] API endpoints return correct data
- [x] Server actions validate authorization
- [x] UI components render properly
- [x] Recommendations generate with valid data
- [x] Add/undo functionality works
- [x] Auto-cleanup removes old recommendations
- [x] Settings persist correctly
- [x] Navigation menu includes Travel AI link

## Dependencies
- Google Maps Distance Matrix API (40,000 free requests/month)
- OpenWeatherMap API (1,000 free calls/day)
- Existing Prisma, Next.js, Material UI stack
