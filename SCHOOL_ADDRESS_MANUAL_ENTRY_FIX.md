# School Address Manual Entry Fix

## Problem
The school address autocomplete component was not properly saving manually entered addresses when users didn't select from the Google Places dropdown. Users could type an address but it wouldn't be saved unless they selected from the autocomplete suggestions.

## Solution
Added an `onBlur` handler to the `SchoolAddressAutocomplete` component that captures manually entered text and saves it when the user clicks away or tabs out of the field.

## Changes Made

### `/src/components/forms/SchoolAddressAutocomplete.tsx`

1. **Added `handleBlur` function** (lines 178-185):
   - Detects when user has typed a value that differs from the current saved value
   - Automatically saves the manually entered address when the field loses focus
   - Trims whitespace before saving

2. **Connected `onBlur` to TextField** (line 220):
   - Added `onBlur={handleBlur}` prop to the TextField component
   - Ensures the blur handler is triggered when user clicks away or tabs out

3. **Updated comment** (line 153):
   - Fixed outdated comment that incorrectly stated freeSolo wouldn't trigger
   - Now correctly documents that freeSolo mode allows manual entry

## User Experience

### Before Fix:
1. User types address manually
2. User clicks away without selecting from dropdown
3. Address is lost/not saved ❌

### After Fix:
1. User types address manually
2. User clicks away (blur event triggered)
3. Address is automatically saved ✅

## Technical Details

- The component already had `freeSolo={true}` enabled, which allows typing
- The missing piece was capturing the typed value when users don't select from dropdown
- The `onBlur` handler bridges this gap by saving on focus loss
- Helper text already says "Start typing or enter address manually" - now it works as described!

## Testing

The fix works for:
- `/onboarding/details` - Onboarding flow school details
- `/dashboard/settings` - Settings page school details editing
- Any other usage of `SchoolAddressAutocomplete` component

## Backward Compatibility

✅ Fully backward compatible:
- Google Places autocomplete still works normally
- Selecting from dropdown still works as before
- Only adds new functionality for manual entry
- No breaking changes to API or data format
