# Opponents Page Win/Loss Tracker UI Updates

## Summary
Complete redesign of the Opponents page score tracker with ESPN-inspired design and W/L/D button system.

## Changes Made

### 1. Score Tracker Card Design
- **Smaller dimensions**: Reduced card padding to `padding: "12px 16px"`
- **Removed box shadow**: Added `boxShadow: "none"` to all score cards
- **Compact spacing**: Reduced all internal margins for a more condensed layout

### 2. Team Divider Line
- **Color update**: Changed divider from black to light gray using `borderColor: "rgba(15, 23, 42, 0.90)"`
- More subtle and professional appearance

### 3. Win/Loss/Draw Buttons (W, L, D)
Replaced thumbs up/down icons with capital letter buttons:
- **W button**: Subtle green background (`rgba(76, 175, 80, 0.15)`), green text
- **L button**: Subtle red background (`rgba(244, 67, 54, 0.15)`), red text  
- **D button**: Orangish yellow background (`rgba(255, 152, 0, 0.15)`), warning text
- All buttons are 32x32px, bold text (700 weight), with hover states
- Added full support for Draw results throughout the component

### 4. Score Input Dialog
- **Simplified label**: Changed home team input from `"${yourTeamName} (Your Team)"` to just `"Your Team"`
- Dialog now supports three result types: "win", "loss", "draw"

### 5. Opponent Name Padding
- Added left padding (`pl: 1`) to opponent names in the Opponents List for better visual alignment

### 6. ESPN-Style Score Display
Complete redesign of score cards with sports-network inspired layout:

**Left Side - Teams and Scores:**
- Winner row with triangle arrow (`PlayArrow` icon) pointing to winner
- Winner name and score in **bold** (fontWeight: 700)
- Loser name and score in **regular** weight (fontWeight: 400)
- Light gray divider between teams

**Right Side - Game Info:**
- Vertical divider separating scores from metadata
- "FINAL" label (uppercase, small, gray) at top
- Date below in format "MMM DD, YYYY" (e.g., "Jan 15, 2024")
- Left-aligned to match ESPN mobile app design

### 7. Spacing Improvements
**Opponents List Container:**
- Increased padding from `p: 2` to `p: 2.5`
- Increased title margin-bottom from `mb: 2` to `mb: 2.5`
- Added right padding to scrollable area (`pr: 0.5`) for better scroll appearance

### 8. Updated Help Text
- Changed instructional text to include Draw option
- Now says: "Click W (Win), L (Loss), or D (Draw) on an opponent card to record a game result"

## Technical Implementation

### New Component Props
- Added `onDraw` handler to `OpponentCard` component
- Updated `ScoreDialogProps` interface to use `resultType: "win" | "loss" | "draw"` instead of `isWin: boolean`

### State Management
- Updated `scoreDialogData` state to use `resultType` field
- Added `handleDraw` callback function
- Modified `handleScoreSubmit` to determine win status from result type

### Imports
- Added `PlayArrow` icon from `@mui/icons-material`
- Removed unused `ThumbUp` and `ThumbDown` icons

## Files Modified
- `/src/components/opponents/Opponents.tsx` (all changes)

## Design Inspiration
ESPN Mobile app scores display - clean, clear hierarchy with bold winners and subtle metadata positioning.

## Testing Notes
- All existing functionality preserved
- Draw results now fully supported in UI and score submission
- Responsive design maintained across all screen sizes
- No breaking changes to API or data structure
