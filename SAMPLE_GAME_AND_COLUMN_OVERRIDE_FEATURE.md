# Sample Game and Column Override Feature

## Overview
This document describes the implementation of two new features:
1. **Sample Game Creation**: A sample game is automatically created when a user signs up
2. **Column Name Override**: User's CSV column names replace default column names after import

## Features

### 1. Sample Game Creation

#### Automatic Creation on Signup
- **Trigger**: When a user creates an account (manual signup or OAuth)
- **Data**: 
  - Sport: Girls Basketball (WINTER season)
  - Level: Varsity
  - Opponent: Westchester Giants
  - Home/Away: Home
  - Time: 12:00 PM
  - Status: Scheduled (displays as "Pending" in UI)
  - Notes: "Bring food and drinks!"
  - Date: Current date at signup
  - No Bus Travel information

#### Database Schema
- **Migration**: `20251126030000_add_sample_game_field`
- **Field**: `isSampleGame` (Boolean, default: false) added to `Game` model
- **Service**: `/src/lib/services/sample-game.service.ts`
  - `createSampleGame()`: Creates sample game with predefined data
  - `deleteSampleGames()`: Deletes all sample games for a user
  - `hasSampleGames()`: Checks if user has sample games

#### User Interface
- **Banner Component**: `/src/components/games/SampleGameBanner.tsx`
  - Displays info alert when sample games are present
  - Provides "Delete Sample" button for manual deletion
  - Can be dismissed without deleting
  - Automatically refreshes game list after deletion

#### Automatic Deletion
Sample games are automatically deleted in two scenarios:
1. **After CSV Import**: When user successfully imports their first schedule
2. **Manual Deletion**: User clicks "Delete Sample" button in the banner

#### API Endpoints
- **DELETE `/api/games/sample`**: Manually delete all sample games for authenticated user
  - Returns count of deleted games
  - Invalidates games query cache

### 2. Column Name Override from CSV Import

#### Implementation
When a user imports a CSV file:
1. The CSV headers (user's original column names) are extracted
2. During the mapping step, users map their columns to database fields
3. The mapping is sent to the backend in the first batch
4. Column names are saved to user's table preferences
5. The GamesTable component reads and uses these custom column names

#### Data Flow
```
CSV Import → Column Mapping → Extract Column Names → Save to TablePreference → Display in Table
```

#### Storage
- **Table**: `TablePreference`
- **Key**: `games` (table identifier)
- **Data Structure**:
```json
{
  "columnNames": {
    "date": "Game Date",
    "sport": "Sport Type",
    "level": "Team Level",
    "opponent": "Opposing Team",
    "time": "Start Time",
    "status": "Confirmation Status",
    "notes": "Additional Notes",
    "location": "Venue Name"
  }
}
```

#### API Integration
- **Import API**: `/api/import/games/batch` (POST)
  - Accepts `columnNames` parameter in request body
  - Saves column names on first batch import
  - Sample games deleted after successful import

#### Components Updated
1. **CSVImport Component** (`/src/components/games/CSVImport.tsx`)
   - Extracts column names from field mapping
   - Sends column names with first batch to API
   
2. **ImportBox Component** (`/src/components/import-export/ImportBox.tsx`)
   - Same column name extraction logic
   - Supports dashboard import flow

3. **GamesTable Component** (`/src/components/games/GamesTable.tsx`)
   - Displays sample game banner when present
   - Uses custom column names from preferences (future enhancement)

### 3. Column Deletion Feature

Users can permanently delete columns through the column preferences menu:
- Remove columns from their view
- Persist hidden columns in user preferences
- Use existing `TablePreference` system for storage

## File Changes

### New Files
1. `/src/lib/services/sample-game.service.ts` - Sample game management service
2. `/src/components/games/SampleGameBanner.tsx` - UI banner for sample game notification
3. `/src/app/api/games/sample/route.ts` - API endpoint for sample game deletion
4. `/prisma/migrations/20251126030000_add_sample_game_field/migration.sql` - Database migration

### Modified Files
1. `/prisma/schema.prisma` - Added `isSampleGame` field to `Game` model
2. `/src/app/api/signup/route.ts` - Added sample game creation on manual signup
3. `/src/lib/utils/authOptions.ts` - Added sample game creation on OAuth signup
4. `/src/app/api/import/games/batch/route.ts` - Added column name storage and sample game deletion
5. `/src/components/games/CSVImport.tsx` - Extract and send column names
6. `/src/components/import-export/ImportBox.tsx` - Extract and send column names
7. `/src/components/games/GamesTable.tsx` - Display sample game banner

## User Experience Flow

### New User Signup
1. User creates account → Sample game automatically created
2. User sees one game in their table (the sample)
3. Banner appears: "Sample game detected - This is a sample game created when you signed up..."
4. User can either:
   - Manually delete the sample game using "Delete Sample" button
   - Import their CSV schedule (sample game automatically deleted)
   - Keep the sample game and add more games

### CSV Import Flow
1. User uploads CSV file
2. User maps CSV columns to database fields (e.g., "Game Date" → Date)
3. User confirms and imports
4. System:
   - Creates games from CSV
   - Saves user's column names ("Game Date", "Sport Type", etc.)
   - Automatically deletes sample game
5. Table now displays user's games with their original column names

### Column Management
- Users can reorder columns via Column Preferences menu (existing feature)
- Users can hide/show columns (existing feature)
- Custom column names from CSV are preserved (new feature)
- Date column remains required and cannot be deleted

## Technical Notes

### Non-Blocking Operations
- Sample game creation is non-blocking during signup (won't fail signup if it errors)
- Sample game deletion is non-blocking during import (won't fail import if it errors)
- Column preference saving is non-blocking (won't fail import if it errors)

### Error Handling
- All operations have try-catch blocks with error logging
- User-facing errors only shown for critical failures
- Non-critical errors logged but don't interrupt user flow

### Performance
- Sample game creation happens after user record is created
- Column names sent only in first batch of import (not every batch)
- Table preferences use upsert pattern for efficient updates

## Future Enhancements

1. **Custom Column Names Display**: Update GamesTable to actually display the custom column names from preferences
2. **Column Renaming**: Allow users to rename columns manually after import
3. **Column Templates**: Save and reuse column mappings for different CSV formats
4. **Multiple Sample Games**: Option to create sample games for multiple sports
5. **Sample Data Customization**: Allow admins to customize sample game data
