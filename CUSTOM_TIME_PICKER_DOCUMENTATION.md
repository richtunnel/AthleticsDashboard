# CustomTimePicker Component Documentation

## Overview
The `CustomTimePicker` component provides **BOTH** manual text input AND a visual time picker modal for time selection.

## Features

### 1. Manual Text Entry ✅
Users can type time directly into the text field using multiple formats:
- **12-hour format**: `3:30 PM`, `03:30 pm`
- **24-hour format**: `15:30`, `3:30`
- **Compact format**: `1530`, `330`
- **Clear value**: Type "TBD" or leave empty to clear

### 2. Visual Time Picker Modal ✅
Users can click the **clock icon** (⏰) on the right side of the input field to open a visual picker with:
- Up/down arrows to adjust hours and minutes
- AM/PM toggle buttons
- Quick preset buttons (8:00 AM, 12:00 PM, 3:00 PM, 6:00 PM)
- Apply/Cancel buttons

## Usage

```tsx
import { CustomTimePicker } from "@/components/ui/CustomTimePicker";

<CustomTimePicker
  value={timeValue}              // HH:MM format (e.g., "15:30")
  onChange={(value) => setTime(value)}
  onBlur={() => handleBlur()}
  autoFocus={false}
  disabled={false}
  size="small"                   // or "medium"
/>
```

## Current Implementation Locations

### 1. GamesTable Component
- **Add New Game Row** (line 2351)
- **Inline Edit Mode** (lines 3289-3296)

### 2. Where NOT Currently Used
The following components still use native HTML `<input type="time">`:
- `GameForm.tsx` - Game time field (line 244)
- `GameForm.tsx` - Departure/Arrival times (lines 337, 345)
- `GamesTable.tsx` - Bus travel departure/arrival in editing row (lines 2811-2873)

## Keyboard Shortcuts

When focused on the text input:
- **Enter**: Save the current value
- **Escape**: Cancel editing and revert to previous value

## Validation

The component automatically validates time input and shows an error message for invalid formats.
Valid times must have:
- Hours: 0-23 (24-hour) or 1-12 (12-hour with AM/PM)
- Minutes: 0-59

## Example

```tsx
// Example in GamesTable for time column
<CustomTimePicker
  value={inlineEditValue}
  onChange={(value) => handleInlineChange(value, game)}
  onBlur={() => handleInlineBlur(game)}
  autoFocus
  disabled={isInlineSaving}
  size="small"
/>
```

## Visual Design

The component includes:
- Text input field with placeholder: "Enter time (e.g., 3:30 PM)"
- Clock icon button in the input's end adornment
- Clean, accessible popover modal
- Clear visual feedback for hover/focus states
