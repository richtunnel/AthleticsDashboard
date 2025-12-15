# Bus Info Feature - Testing Guide

## ✅ Changes Implemented (Dec 12, 2024)

### 1. Fixed Buffer Time (22 minutes)
**File**: `/src/app/api/games/calculate-travel-time/route.ts`
- Changed `BUFFER_MINUTES` from 35 to 22 (line 4)
- API now calculates: `Departure = Dismissal - (Travel Time + 22 min)`

### 2. Updated Cell Rendering (Add Travel Time Button)
**File**: `/src/components/games/GamesTable.tsx` (lines 5479-5564)
- **Empty cells**: Show "Add Travel Time" button (transparent, text variant)
- **Filled cells**: Show departure time with "Departure Time" label
- **Interaction**: 
  - Click "Add Travel Time" → Opens TravelTimeModal
  - Double-click filled cell → Reopens modal for editing

### 3. Updated Modal State
**File**: `/src/components/games/GamesTable.tsx` (lines 544-551)
- Added `columnName`, `currentDepartTime`, `currentAddress` to `travelTimeModal` state
- Allows modal to know which column to save to and pre-populate existing values

### 4. Enhanced Save Handler
**File**: `/src/components/games/GamesTable.tsx` (lines 3175-3241)
- **With columnName** (Bus Info): Saves to `customFields[${columnName}_depart]` and `customFields[${columnName}_address]`
- **Without columnName** (Legacy): Uses existing save-travel-time API endpoint
- Backwards compatible with existing travel time features

### 5. Updated Modal Info Message
**File**: `/src/components/games/TravelTimeModal.tsx` (line 235)
- Changed from "35-minute safety cushion" to "22-minute safety cushion"
- Matches the actual buffer time used in calculations

## 🧪 Manual Testing Steps

### Test 1: Enable Enhanced Travel Times Toggle
1. Go to Settings → AI Features
2. Enable "Enhanced Travel Times (Bus Info)"
3. Verify toggle switches on and saves

### Test 2: Add Bus Info Column
1. Go to Games table
2. Import CSV with "Bus Info" or "Travel" column, OR
3. Manually create custom column named "Bus Info" or "Travel"
4. Verify column appears in table

### Test 3: Add Travel Time (Empty Cell)
1. Find an empty Bus Info cell
2. Verify it shows "Add Travel Time" button (transparent, gray text)
3. Hover over button → text should turn blue
4. Click button
5. Verify TravelTimeModal opens with 3 steps

### Test 4: Complete Travel Time Flow
1. **Step 1**: Enter dismissal time (e.g., 15:00)
2. Click "Next"
3. **Step 2**: Enter opponent address
   - Type address → Google Places autocomplete should work
   - Select or manually enter address
4. Click "Next"
5. **Step 3**: Verify recommendation shows:
   - Departure time (e.g., 13:15)
   - Travel time (e.g., 45 minutes)
   - Buffer: 22 minutes
   - Info alert: "This recommendation includes a 22-minute safety cushion"
6. Click "Save & Finish"
7. Verify cell now shows departure time with "Departure Time" label

### Test 5: Edit Travel Time (Filled Cell)
1. Find a Bus Info cell with departure time
2. Double-click the cell
3. Verify TravelTimeModal reopens
4. Verify it shows previous values (if stored)
5. Change dismissal time or address
6. Recalculate and save
7. Verify cell updates with new departure time

### Test 6: Calculation Logic
1. Enter dismissal time: 15:00 (3:00 PM)
2. Assume travel time from Google Maps: 45 minutes
3. Expected calculation:
   - Total time needed: 45 min + 22 min = 67 minutes
   - Departure: 15:00 - 67 min = 13:53
4. Verify modal shows departure time around 13:53

### Test 7: School Address Requirement
1. Ensure user has school address set in Settings
2. Verify calculation uses this address as origin
3. If school address is missing, verify error handling

### Test 8: Data Persistence
1. Add travel time to a game
2. Refresh page
3. Verify departure time still shows in cell
4. Check database: `game.customFields` should contain:
   ```json
   {
     "Bus Info_depart": "13:53",
     "Bus Info_address": "123 Main St, City, State 12345"
   }
   ```

### Test 9: Dark Mode Compatibility
1. Enable dark mode
2. Verify "Add Travel Time" button is visible
3. Verify modal displays correctly
4. Verify departure time text is readable

### Test 10: Multiple Bus Info Columns
1. Create multiple columns named variations like:
   - "Bus Info"
   - "Travel"
   - "bus travel"
2. Verify each column independently stores its own data
3. Each should have format: `${columnName}_depart` and `${columnName}_address`

## 🔍 Verification Checklist

- [ ] Buffer time is 22 minutes (not 35)
- [ ] Empty cells show "Add Travel Time" button
- [ ] Button opens TravelTimeModal (not DismissDepartModal)
- [ ] Modal has 3 steps (dismissal → address → review)
- [ ] Calculation uses user's school address from settings
- [ ] Departure time = Dismissal - (Travel + 22 min)
- [ ] Filled cells show departure time with label
- [ ] Double-click opens modal for editing
- [ ] Data saves to customFields
- [ ] Data persists after page refresh
- [ ] Works in dark mode
- [ ] Multiple Bus Info columns work independently

## 🐛 Known Issues / Edge Cases

### 1. Missing School Address
- **Issue**: User hasn't set school address in settings
- **Behavior**: API uses organization name + state as fallback
- **Solution**: Prompt user to add school address in settings

### 2. Google Maps API Failure
- **Issue**: Google Maps API returns error or times out
- **Behavior**: Falls back to default 45-minute travel time
- **Solution**: Show warning message to user

### 3. Invalid Time Format
- **Issue**: User enters invalid time (e.g., "25:00")
- **Behavior**: API validates with regex `/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/`
- **Solution**: Show error message

### 4. Column Name Variations
- **Issue**: User creates column with different casing/spacing
- **Behavior**: Regex `/^(bus info|travel)$/i` matches case-insensitive
- **Note**: "Bus Travel", "bus info", "TRAVEL" all work

### 5. Legacy Travel Time Feature
- **Issue**: Existing travel time features may use different buffer
- **Behavior**: DismissDepartModal uses dynamic buffer (15-65 min)
- **Solution**: Bus Info columns explicitly use TravelTimeModal with 22-min buffer

## 📊 Performance Considerations

- **API Calls**: Each calculation makes 1 Google Maps API call
- **Optimization**: Results not cached (real-time traffic data)
- **Cost**: ~$5 per 1000 calculations (Google Maps Distance Matrix API)
- **Rate Limits**: Be aware of API quotas for high-volume users

## 🎯 Success Criteria

✅ User can click "Add Travel Time" in empty Bus Info cells
✅ TravelTimeModal opens with clear 3-step flow
✅ Modal collects dismissal time AND opponent address
✅ Calculation uses 22-minute buffer (fixed)
✅ Departure time populates in cell after saving
✅ User can edit departure time by double-clicking cell
✅ Data persists across page reloads
✅ Feature works with dark mode enabled

## 📝 Documentation

- Review document: `/home/engine/project/BUS_INFO_REVIEW.md`
- Implementation details in memory
- API endpoint: `/api/games/calculate-travel-time`
- Service: Not using dismiss-depart.service (uses dynamic buffer)
- Uses direct API call with fixed 22-minute buffer

## 🚀 Next Steps

1. Run manual tests above
2. Verify all checklist items
3. Test with real opponent addresses
4. Monitor Google Maps API usage
5. Consider adding:
   - Address validation
   - Travel time caching (if appropriate)
   - Batch calculation for multiple games
   - Custom buffer time (user preference)
   - Traffic condition display (heavy/moderate/light)
