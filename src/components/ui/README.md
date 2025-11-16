# UI Components

This directory contains reusable UI components used throughout the application.

## CustomTimePicker

A custom time picker component designed for cross-browser compatibility, especially for Safari where native HTML5 time inputs have poor UX.

### Features

- **Cross-browser compatible**: Works consistently across Chrome, Firefox, Safari, and Edge
- **Intuitive interface**: Click-to-open popover with hour/minute selectors
- **Arrow controls**: Easy-to-use up/down arrows for adjusting time values
- **Quick presets**: Pre-defined time buttons (8:00 AM, 12:00 PM, 3:00 PM, 6:00 PM)
- **12-hour format display**: User-friendly AM/PM format
- **24-hour format output**: Returns standard HH:MM format for consistency
- **Accessible**: Keyboard navigation and ARIA support
- **Responsive**: Clean, modern design that works on all screen sizes

### Usage

```tsx
import { CustomTimePicker } from "@/components/ui/CustomTimePicker";

<CustomTimePicker
  value="14:30" // HH:MM format (24-hour)
  onChange={(value) => console.log(value)} // Returns HH:MM format
  onBlur={() => console.log("Picker closed")}
  disabled={false}
  autoFocus={true}
  size="small" // or "medium"
/>
```

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | Yes | - | Time value in HH:MM format (24-hour) |
| `onChange` | `(value: string) => void` | Yes | - | Callback when time is selected, returns HH:MM format |
| `onBlur` | `() => void` | No | - | Callback when picker is closed |
| `disabled` | `boolean` | No | `false` | Disables the picker |
| `autoFocus` | `boolean` | No | `false` | Auto-focuses the picker on mount |
| `size` | `"small" \| "medium"` | No | `"small"` | Size variant |

### Implementation Details

- **Display format**: Shows time as "h:mm AM/PM" (e.g., "2:30 PM")
- **Output format**: Returns time as "HH:MM" (e.g., "14:30")
- **Minute increments**: Uses 5-minute intervals for quick selection
- **Default time**: If no value provided, initializes to current time
- **Browser compatibility**: Does not rely on native HTML5 time input

### Safari Compatibility

This component was specifically created to address Safari's poor support for HTML5 time inputs. In Safari:
- Native time inputs don't show a clickable clock icon in many contexts
- The time picker UI is inconsistent and hard to use
- Double-click to edit doesn't trigger the native picker reliably

The `CustomTimePicker` solves these issues by providing a consistent, reliable time selection interface across all browsers.

### Integration

Currently integrated into:
- **GamesTable** - For editing game times (inline edit, new row, full row edit modes)
- Can be easily integrated into any form or table that requires time input

### Future Enhancements

Potential improvements for future versions:
- Support for custom minute intervals (1, 10, 15, 30 minutes)
- Custom preset time buttons
- 24-hour display mode option
- Touch-friendly mobile optimizations
- Keyboard shortcuts for power users
