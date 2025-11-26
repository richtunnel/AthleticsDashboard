# Opponents List - Scoreboard Icon Update

## Summary
Replaced the W, L, D buttons in the Opponents list with a single ScoreboardIcon that opens a modal with auto-calculated results.

## Changes Made

### 1. **UI Changes - OpponentCard Component**
- **Replaced**: Three buttons (W, L, D) 
- **With**: Single ScoreboardIcon button with tooltip
- **Tooltip**: "Enter game score"
- **Styling**: Blue theme (`rgba(33, 150, 243, 0.15)`) with hover effect

### 2. **Modal Enhancements - ScoreDialog Component**
- **Removed**: `resultType` prop (no longer needed)
- **Added**: Auto-calculation logic that determines Win/Loss/Draw based on scores
- **Added**: Descriptive text below title explaining auto-calculation
- **Added**: Example text showing how it works (e.g., "Your Team: 3, Opponent: 1 = Win")
- **Added**: Real-time result preview with colored indicators:
  - ✓ **Win** (Green) - "Your team scored higher"
  - ✗ **Loss** (Red) - "Opponent scored higher"  
  - — **Draw** (Orange) - "Scores are tied"

### 3. **Logic Updates**
- **Simplified State**: Removed `resultType` from scoreDialogData state
- **Unified Handler**: Replaced `handleWin`, `handleLoss`, `handleDraw` with single `handleOpenScoreModal`
- **Auto-calculation**: `isWin = yourScore > opponentScore` in `handleScoreSubmit`
- **Color Consistency**: Used same color scheme as original (green for win, red for loss, orange for draw)

### 4. **Updated Text Instructions**
- Opponents List subtitle: "Click the scoreboard icon to enter game scores and track results"
- Empty state: "Record results by clicking the scoreboard icon on opponent cards"

## User Experience Flow
1. User clicks ScoreboardIcon on any opponent card
2. Modal opens with title "Enter Game Score"
3. User sees instructions and example
4. User enters both team scores
5. Real-time preview shows calculated result (Win/Loss/Draw) with colored indicator
6. User clicks "Save Result"
7. System automatically determines and saves the correct result

## Benefits
- **Simpler UI**: One button instead of three
- **Less Error-Prone**: User can't accidentally click wrong button (W vs L)
- **More Intuitive**: Users think in terms of scores, not outcomes
- **Better UX**: Real-time feedback shows what will be saved
- **Cleaner Design**: Scoreboard icon is universally recognized for scores

## Technical Details
- **Import Added**: `ScoreboardIcon from '@mui/icons-material/Scoreboard'`
- **Backward Compatible**: No API changes, only frontend logic updates
- **Same Data Model**: Still saves `isWin` boolean to database as before
