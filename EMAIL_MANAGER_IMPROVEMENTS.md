# Email Manager Improvements - Collapsible Emails & Search

## Overview
Enhanced the Email Campaign Manager to handle email groups with large numbers of emails more efficiently by adding collapsible email lists and a search feature.

## Changes Made

### 1. Collapsible Email Lists
- **Default View**: Shows only the first 5 emails in each group card
- **Expandable**: Users can click "Show X more" to expand and see all emails
- **Collapsible**: Click "Show less" to minimize back to the first 5 emails
- **Smart Display**: If a group has 5 or fewer emails, they are all shown by default (no collapse/expand needed)

### 2. Search Functionality
- **Search Input**: Appears automatically when a group has more than 5 emails
- **Real-time Filtering**: Filters emails as you type based on email address
- **Clear Button**: Quick clear button (X icon) in the search input to reset the search
- **Search Counter**: Shows "Showing X of Y emails" when search is active
- **Auto-expand**: When searching, automatically expands the list to show all matching results
- **No Results Message**: Displays a helpful message when no emails match the search query

### 3. Improved UX
- **Increased List Height**: Changed max height from 220px to 300px for better viewing
- **Search Icon**: Visual search icon in the input field for better UI clarity
- **Expand/Collapse Icons**: Intuitive up/down arrow icons on the expand/collapse button
- **Count Display**: Shows exactly how many more emails are hidden (e.g., "Show 47 more")

## Implementation Details

### Component: `EmailGroupCard.tsx`
Located at: `/src/components/communication/email/EmailGroupCard.tsx`

### New State Variables
- `searchQuery`: Stores the current search input
- `showAllEmails`: Boolean to track expand/collapse state

### New Constants
- `DEFAULT_VISIBLE_EMAILS = 5`: Number of emails to show by default

### New Computed Values
- `filteredEmails`: Emails filtered by search query
- `displayedEmails`: Final list of emails to display (considers both filtering and collapse state)
- `hasMoreEmails`: Boolean indicating if there are more emails than the default visible count

### Key Features
1. **Search only shows for large groups**: Search input only appears when group has > 5 emails
2. **Automatic expansion on search**: When user starts typing, list automatically expands
3. **Preserve edit functionality**: All existing edit/remove email features still work with search and collapse
4. **Performance optimized**: Uses React `useMemo` hooks to prevent unnecessary re-renders

## User Experience Flow

### Scenario 1: Small Group (≤ 5 emails)
- All emails visible immediately
- No search bar
- No expand/collapse button

### Scenario 2: Large Group (> 5 emails)
1. Card shows first 5 emails
2. Search bar appears above the email list
3. "Show X more" button appears below the list
4. User can:
   - Click expand to see all emails
   - Search to filter specific emails
   - Edit/remove emails as normal

### Scenario 3: Searching in a Large Group
1. User types in search field
2. List automatically expands
3. Only matching emails are shown
4. Counter shows "Showing X of Y emails"
5. Clear search to see all emails again

## Technical Notes
- Search is case-insensitive
- Search matches any part of the email address
- All mutations (add, edit, remove) work correctly with filtered/collapsed views
- State resets appropriately when toggling between groups
