# CSV Import Mapping Updates

## Summary
Updated the CSV import feature to improve column mapping options and auto-detection logic.

## Changes Made

### 1. Updated Database Field Options
**Removed:**
- "Status" (was showing as a standalone option, now labeled as "Confirmed")
- "Venue" (removed as it's a relation field, not a direct database field)

**Updated Labels:**
- "Location" → "Location or Venue" (to clarify it can contain venue information)
- "Status" → "Confirmed" (better reflects user-facing intent)

**Final Mapping Options (in order):**
1. Date (required)
2. Sport
3. Level
4. Home/Away
5. Opponent
6. Location or Venue
7. Time
8. Confirmed
9. Bus Travel
10. Notes
11. Skip Column

### 2. Enhanced Auto-Mapping Logic

#### Bus Travel Auto-Detection
If a CSV column name contains any of these terms (case-insensitive), it will automatically map to "Bus Travel":
- "travel"
- "bus"
- "departure"
- "commute"

**Examples:**
- "Bus Travel" → Bus Travel ✓
- "Travel Required" → Bus Travel ✓
- "Departure Time" → Bus Travel ✓
- "Bus" → Bus Travel ✓

#### Smart "Away" Column Detection
If a CSV column name contains "away", the system now intelligently checks the actual data:
- **If data contains "Away" or "Home"** (case-insensitive) → Maps to "Home/Away"
- **If data does NOT contain "Away" or "Home"** → Maps to "Opponent"

**Examples:**
- Column "Away" with values like "Home", "Away" → Home/Away ✓
- Column "Away" with values like "Lincoln High", "Roosevelt HS" → Opponent ✓

### 3. Improved Data Transformation

#### Confirmed Field Handling
The "Confirmed" field now accepts multiple input formats:
- Status values: "confirmed", "scheduled", "cancelled", "postponed", "completed"
- Boolean values: "yes"/"no", "true"/"false", "1"/"0"
- Defaults to "SCHEDULED" if empty or unrecognized

#### Bus Travel Field Handling
The "Bus Travel" field now properly handles boolean inputs:
- True values: "yes", "true", "1", "y"
- All other values: false (default)

### 4. Updated Sample CSV Template
The downloadable template now includes:
```csv
date,sport,level,home_away,opponent,location,time,confirmed,bus_travel,notes
2024-01-15,Basketball,Varsity,Home,Lincoln High,Home Gym,15:00,Yes,No,Senior Night
2024-01-20,Football,JV,Away,Roosevelt HS,Roosevelt Stadium,18:30,Yes,Yes,Bring extra uniforms
```

## Files Modified
- `/src/components/games/CSVImport.tsx`

## Testing Recommendations
1. Test CSV import with various column names for bus travel (e.g., "Travel", "Bus", "Departure")
2. Test "Away" column with team names vs. "Home"/"Away" values
3. Test "Confirmed" column with boolean values (Yes/No, True/False)
4. Verify the sample template download includes all updated columns
5. Ensure backward compatibility with existing CSV files
