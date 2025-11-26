# Opponents Score Tracker Fixes

## Changes Made

### 1. Fixed Team/School Name Display Order (Line 413-415)
**Issue**: The opponent name was showing the user's personal name instead of Team or School name.

**Fix**: Changed the fallback order to prioritize Team name over School name, and removed the fallback to user's personal name.

**Before**:
```typescript
const yourTeamName = useMemo(() => {
  return userData?.user?.schoolName || userData?.user?.teamName || userData?.user?.name || "Your Team";
}, [userData?.user]);
```

**After**:
```typescript
const yourTeamName = useMemo(() => {
  return userData?.user?.teamName || userData?.user?.schoolName || "Your Team";
}, [userData?.user]);
```

### 2. Added Total Games and Won Games Statistics (Lines 417-419, 782-802)
**Issue**: The Score Tracker only showed the total number of games without showing how many were won.

**Fix**: 
- Added a computed `wonGamesCount` value that filters matchup results where `isWin === true`
- Updated the Score Tracker header to display two chips:
  - Total games count (e.g., "5 Games")
  - Won games count with green styling (e.g., "3 Won")

**New Code**:
```typescript
// Computed value for won games count
const wonGamesCount = useMemo(() => {
  return matchupResults.filter((result: MatchupResult) => result.isWin).length;
}, [matchupResults]);

// Updated header with statistics
<Box sx={{ display: "flex", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
  <Typography variant="h6" sx={{ fontWeight: 600 }}>
    Score Tracker
  </Typography>
  <Box sx={{ display: "flex", gap: 1 }}>
    <Chip 
      label={`${matchupResults.length} Games`} 
      size="small" 
      sx={{ bgcolor: "rgba(15, 23, 42, 0.08)" }} 
    />
    <Chip 
      label={`${wonGamesCount} Won`} 
      size="small" 
      sx={{ 
        bgcolor: "rgba(76, 175, 80, 0.15)", 
        color: "success.main",
        fontWeight: 600 
      }} 
    />
  </Box>
</Box>
```

### 3. Added Green "W" Badge to Winner Row (Lines 852-870)
**Issue**: The winner row only had an arrow icon without a clear visual indicator that it was the winner.

**Fix**: Added a green "W" badge between the arrow icon and the winner's name.

**New Code**:
```typescript
<Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
  <PlayArrow
    sx={{
      fontSize: 18,
      mr: 0.5,
      color: "text.secondary",
    }}
  />
  <Box
    sx={{
      bgcolor: "rgba(76, 175, 80, 0.15)",
      color: "success.main",
      fontWeight: 700,
      fontSize: "11px",
      borderRadius: "4px",
      px: 0.5,
      py: 0.25,
      mr: 0.75,
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "18px",
    }}
  >
    W
  </Box>
  <Typography
    variant="body2"
    sx={{
      fontWeight: 700,
      fontSize: "14px",
      flex: 1,
    }}
  >
    {winnerName}
  </Typography>
  {/* ... score display ... */}
</Box>
```

## Visual Impact

### Before:
- Score Tracker header: "Score Tracker [5]" (single badge with count)
- Winner row: Arrow icon → Team name
- Opponent display: Could show user's personal name

### After:
- Score Tracker header: "Score Tracker [5 Games] [3 Won]" (two badges with clear labels)
- Winner row: Arrow icon → Green "W" badge → Team name
- Opponent display: Shows Team name if available, otherwise School name

## Technical Details
- All changes maintain TypeScript type safety
- Uses Material UI styling patterns consistent with the rest of the application
- Responsive design - works on all screen sizes
- No breaking changes to existing functionality
