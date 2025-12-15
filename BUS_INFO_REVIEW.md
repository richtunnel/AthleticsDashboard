# Bus Info Column (Enhanced Travel Times) - Implementation Review

## Current State Analysis

### ✅ What's Working
1. **Column Detection**: The code correctly detects Bus Info/Travel columns when AI Travel Times is enabled
2. **Data Storage**: Uses `customFields` to store dismissal and departure times (`${columnName}_dismiss`, `${columnName}_depart`)
3. **Modals Exist**: Both `TravelTimeModal` and `DismissDepartModal` components are implemented
4. **API Endpoints**: Both `/api/games/calculate-travel-time` and `/api/games/calculate-depart-time` exist
5. **Services**: `dismiss-depart.service.ts` handles intelligent buffer calculations based on traffic/weather

### ❌ Issues Found

#### 1. **Wrong Modal Being Used**
- **Location**: `GamesTable.tsx` line 5500
- **Issue**: Opens `DismissDepartModal` instead of `TravelTimeModal`
- **Problem**: `DismissDepartModal` doesn't ask for address (assumes venue exists)
- **Requirement**: Should open `TravelTimeModal` which asks for BOTH dismissal time AND address

#### 2. **Missing "Add Travel Time" Button**
- **Location**: `GamesTable.tsx` lines 5479-5531
- **Issue**: When cell is empty, shows "—" instead of a button
- **Requirement**: Should show a transparent button with text "Add Travel Time"

#### 3. **Wrong Buffer Time (22 min vs 35 min)**
- **Location**: `/api/games/calculate-travel-time/route.ts` line 4
- **Issue**: Uses `BUFFER_MINUTES = 35`
- **Requirement**: Should be 22 minutes
- **Note**: The other service (`dismiss-depart.service.ts`) uses dynamic buffer (15-65 min) which is better but doesn't match the 22-minute requirement

#### 4. **Cell Display Logic**
- **Location**: `GamesTable.tsx` lines 5510-5529
- **Issue**: Shows "Dismiss" and "Depart" labels
- **Requirement**: After calculation, cell should show the departure time that user can edit

#### 5. **Modal Flow Discrepancy**
- **TravelTimeModal**: 3-step flow (dismissal → address → review)
- **DismissDepartModal**: Simple 2-field form (dismissal → calculate → save)
- **Requirement**: Should use the stepper flow to collect address

## Recommended Changes

### Priority 1: Fix Modal and Button Display

**File**: `src/components/games/GamesTable.tsx` (lines 5479-5531)

```typescript
if (shouldShowEnhancedBusInfo) {
  const dismissTime = customFields[`${columnName}_dismiss`] || "";
  const departTime = customFields[`${columnName}_depart`] || "";
  const opponentAddress = customFields[`${columnName}_address`] || "";
  
  const hasData = dismissTime && departTime;
  
  if (!hasData) {
    // Show "Add Travel Time" button when empty
    return (
      <TableCell
        key={column.id}
        sx={{
          py: 1,
          minWidth: 180,
          textAlign: "center",
        }}
      >
        <Button
          variant="text"
          size="small"
          onClick={() => {
            const opponentName = game.opponent?.name || "TBD";
            const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
            setTravelTimeModal({
              open: true,
              gameId: game.id,
              gameName,
              columnName,
            });
          }}
          sx={{
            textTransform: "none",
            color: "text.secondary",
            fontSize: 13,
            fontWeight: 400,
            "&:hover": {
              bgcolor: "transparent",
              color: "primary.main",
            },
          }}
        >
          Add Travel Time
        </Button>
      </TableCell>
    );
  }
  
  // Show calculated departure time (editable on double-click)
  const departDisplay = departTime ? formatTimeDisplay(departTime) : "—";
  
  return (
    <TableCell
      key={column.id}
      sx={{
        py: 1,
        minWidth: 180,
        cursor: "pointer",
        textAlign: "center",
        "&:hover": {
          bgcolor: "action.hover",
        },
      }}
      onDoubleClick={() => {
        const opponentName = game.opponent?.name || "TBD";
        const gameName = `${game.homeTeam.sport.name} vs ${opponentName}`;
        setTravelTimeModal({
          open: true,
          gameId: game.id,
          gameName,
          columnName,
          currentDepartTime: departTime,
          currentAddress: opponentAddress,
        });
      }}
    >
      <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>
        {departDisplay}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: 11, color: "text.secondary", display: "block" }}>
        Departure Time
      </Typography>
    </TableCell>
  );
}
```

### Priority 2: Fix Buffer Time

**File**: `src/app/api/games/calculate-travel-time/route.ts` (line 4)

```typescript
const BUFFER_MINUTES = 22; // Fixed 22-minute cushion as per requirements
```

### Priority 3: Update TravelTimeModal to Save Address

**File**: `src/components/games/TravelTimeModal.tsx`

Need to update the `onSave` prop signature to include address:
```typescript
onSave: (departureTime: string, address: string) => void;
```

And in GamesTable.tsx, handle the save to store the address:
```typescript
const handleTravelTimeSave = async (departureTime: string, address: string) => {
  const { gameId, columnName } = travelTimeModal;
  
  await fetch("/api/games/update-bus-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId,
      columnName,
      departTime: departureTime,
      address,
    }),
  });
  
  // Refresh data
  await refetchGames();
  setTravelTimeModal({ open: false, gameId: "", gameName: "", columnName: "" });
};
```

### Priority 4: User's School Address

**Source**: The calculation already pulls from user's school address (set in settings):
- `calculate-travel-time/route.ts` line 55: `organization.schoolAddress`
- This is correct ✅

### Priority 5: Editable Departure Time

Currently, double-clicking reopens the modal. This allows users to:
1. See the previous calculation
2. Adjust the dismissal time
3. Recalculate
4. Manually edit the departure time field

This meets the requirement ✅

## Implementation Summary

### Files to Modify:
1. ✅ `src/app/api/games/calculate-travel-time/route.ts` - Change buffer from 35 to 22 minutes
2. ✅ `src/components/games/GamesTable.tsx` - Update cell rendering and modal logic
3. ✅ `src/components/games/TravelTimeModal.tsx` - Already correct, just verify
4. ⚠️ Need API endpoint to save bus info to customFields

### Logic Flow (Corrected):
1. User enables "Enhanced Travel Times (Bus Info)" toggle
2. Travel column appears in games table
3. Empty cells show "Add Travel Time" button (transparent/text button)
4. Click button → Opens TravelTimeModal (stepper flow)
5. Step 1: Enter dismissal time
6. Step 2: Enter opponent address (with Google Places autocomplete)
7. Step 3: Review recommendation (22-minute cushion)
8. On save:
   - Store departure time in `customFields[${columnName}_depart]`
   - Store address in `customFields[${columnName}_address]`
9. Cell now shows departure time
10. Double-click to edit/recalculate

### Calculation Logic:
```
Recommended Departure = Dismissal Time - (Travel Time + 22 minutes)
```

Where:
- **Dismissal Time**: User input (HH:MM)
- **Travel Time**: Google Maps API (school address → opponent address)
- **22-minute cushion**: Fixed buffer as per requirements
- **School Address**: From user settings (schoolAddress field)

### Data Storage:
All data stored in `game.customFields` JSON:
```json
{
  "Bus Info_depart": "13:30",
  "Bus Info_address": "123 Main St, City, State 12345"
}
```

## Testing Checklist
- [ ] Toggle "Enhanced Travel Times" on
- [ ] Verify "Add Travel Time" button appears in empty cells
- [ ] Click button opens TravelTimeModal (not DismissDepartModal)
- [ ] Enter dismissal time (e.g., 15:00)
- [ ] Enter opponent address with autocomplete
- [ ] Verify calculation shows 22-minute buffer
- [ ] Save and verify departure time appears in cell
- [ ] Double-click cell to edit/recalculate
- [ ] Verify school address is pulled from settings
- [ ] Verify manual edit of departure time works

## Notes
- The `dismiss-depart.service.ts` uses dynamic buffer calculation (15-65 min) which is more intelligent (considers traffic/weather) but doesn't match the fixed 22-minute requirement
- If dynamic buffer is preferred over fixed 22-minute, we should update requirements
- Current implementation has TWO modal options - we should consolidate to use TravelTimeModal for consistency
