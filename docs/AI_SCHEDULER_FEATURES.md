# AI Scheduler & Enhanced Features

## Overview
This document describes the new features added to help athletic directors schedule games more efficiently.

## Features

### 1. Weekly Schedule View (Dashboard)
**Location:** Dashboard homepage

**Change:** The "Upcoming Games" widget now shows the next **7 days** (1 week) instead of 3 days.

**Benefit:** Athletic directors can now see a full week of upcoming games at a glance, making it easier to plan schedules that are typically sent out weekly.

---

### 2. Coach Access & Team Filtering
**Location:** User management, Games table

**Feature:** Coaches can now be assigned to specific teams and will only see games for their assigned team.

**Implementation:**
- Admin/AD users can assign coaches to teams via the user management interface
- When a coach logs in, they automatically see only games for their assigned team
- This provides focused, team-specific views while maintaining data security

**Database:** 
- New field: `User.assignedTeamId` (optional foreign key to Team)
- Migration: `20251109172302_add_coach_team_assignment`

**Access Control:**
- Coaches (role: `COACH`) with an `assignedTeamId` see filtered games
- Athletic Directors and Assistant ADs continue to see all games

---

### 3. AI Scheduler Assistant
**Location:** Games table toolbar (button next to "Create Game")

**Feature:** An AI-powered assistant that helps find the best date/time for scheduling games and generates professional emails.

#### How It Works:

1. **Click "AI Scheduler Assistant"** in the games toolbar
2. **Enter game details:**
   - Opponent school name
   - Sport (Football, Basketball, etc.)
   - Team level (Varsity, JV, Freshman, etc.)
   - Game type (Home or Away)

3. **AI analyzes your schedule:**
   - Scans existing games for the next 45 days
   - Identifies open dates and time slots
   - Considers sport-specific scheduling patterns
   - Avoids back-to-back game days when possible

4. **Get intelligent suggestions:**
   - Recommended date and time
   - Reasoning for the recommendation
   - Warning about potential conflicts
   - Alternative dates with explanations

5. **Generate professional email:**
   - AI writes a courteous, professional email
   - Includes proposed date/time and alternatives
   - Ready to copy and send to opponent's athletic director
   - Customized based on your school and game details

#### API Endpoints:
- `GET /api/ai-scheduler/available-slots` - Find open slots
- `POST /api/ai-scheduler/suggest` - Get scheduling suggestion
- `POST /api/ai-scheduler/generate-email` - Generate email

#### Configuration:
- Requires `OPENAI_API_KEY` environment variable
- Falls back to rule-based logic if OpenAI is not configured
- Looks 45 days ahead for scheduling opportunities

---

### 4. Map-Based Travel Times
**Feature:** Real-time travel time calculations using Google Maps with traffic data.

**How It Works:**
- When creating/editing away games with travel, the system can calculate accurate travel times
- Uses Google Maps Distance Matrix API to get:
  - Travel duration (base time)
  - Traffic conditions (light, moderate, heavy)
  - Estimated time with current/predicted traffic
  - Distance information

**Integration with Travel Recommendations:**
- Travel AI service (`travelAIService`) uses real-time data
- Recommends bus departure times based on:
  - Actual travel time (not estimates)
  - Current/predicted traffic conditions
  - Weather forecasts
  - Configurable buffer times
  - Bus loading time

**Configuration:**
- Requires `GOOGLE_MAPS_API_KEY` environment variable
- Organization settings: `TravelSettings` table
  - `defaultBufferMinutes` (default: 45)
  - `busLoadingMinutes` (default: 15)
  - `autoFillEnabled` (automatic travel suggestions)

---

### 5. AI Email Generation
**Feature:** Generate professional scheduling emails automatically.

**Use Cases:**
1. **Scheduling requests** - Request games with other schools
2. **Confirmation emails** - Confirm scheduled games
3. **Rescheduling requests** - Propose new dates for conflicts

**AI Features:**
- Professional, courteous tone
- Includes all relevant details (date, time, location)
- Suggests alternatives when available
- Customized based on:
  - Opponent school name
  - Sport and level
  - Home/away game
  - Your school information

**Access:**
- Available through AI Scheduler Assistant workflow
- Can be copied to clipboard
- Ready to send via your email client

---

## Benefits

### Time Savings
- **Before:** Hours spent calling schools, comparing calendars, drafting emails
- **After:** Minutes to get AI suggestions and generate professional emails

### Reduced Conflicts
- AI analyzes entire schedule to avoid double-bookings
- Warns about tight scheduling (games too close together)
- Considers venue availability

### Professional Communication
- Consistent, professional email tone
- No typos or missing information
- Alternative dates automatically included

### Better Planning
- See full week of upcoming games (not just 3 days)
- Real travel times based on traffic patterns
- Weather-aware departure recommendations

---

## User Workflow Example

**Scenario:** Schedule a Varsity Basketball game

1. Click **"AI Scheduler Assistant"** button
2. Enter:
   - Opponent: "Lincoln High School"
   - Sport: Basketball
   - Level: Varsity
   - Type: Home Game
3. Click **"Find Available Time"**
4. Review AI suggestion:
   - "Tuesday, January 15, 2025 at 6:00 PM"
   - Reason: "Optimal day for basketball, no conflicts, allows 2-day rest after previous game"
   - Alternative: "Thursday, January 17 at 6:00 PM"
5. Click **"Generate Email"**
6. Review and copy professional email:
   ```
   Subject: Varsity Basketball Game Scheduling - January 15

   Dear Athletic Director,

   I hope this email finds you well. I am reaching out to schedule a 
   Varsity Basketball game between our schools.

   Based on our current schedule, I would like to propose:
   - Date: Tuesday, January 15, 2025
   - Time: 6:00 PM
   - Location: Our facility (Home game for us)

   If this date doesn't work, we also have availability on Thursday, 
   January 17 at 6:00 PM.

   Please let me know if either of these dates work for your schedule.

   Best regards
   ```
7. Send email to opponent's AD
8. Once confirmed, create game in schedule

---

## Technical Details

### Services
- `aiScheduler.service.ts` - Core scheduling logic
- `travelAI.ts` - Travel time recommendations
- `googleMaps.ts` - Maps API integration

### Components
- `AISchedulerAssistant.tsx` - UI dialog component
- `CalendarPreviewWidget.tsx` - Dashboard widget

### Database Changes
- `User.assignedTeamId` - Coach team assignment
- Migration: `20251109172302_add_coach_team_assignment`

---

## Environment Variables

Required for full functionality:

```env
# AI Features
OPENAI_API_KEY=sk-your-openai-api-key

# Travel Times
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Weather (optional, for travel recommendations)
OPENWEATHER_API_KEY=your-openweather-api-key
```

---

## Future Enhancements

Potential improvements:
- Multi-school availability coordination
- Recurring game scheduling
- Automated conflict resolution
- Integration with other schools' calendars
- SMS notifications for schedule updates
- Mobile app for on-the-go scheduling
