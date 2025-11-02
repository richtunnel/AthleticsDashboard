# Fix: Email Groups Not Appearing in Compose Email Dropdown

## Problem
When users created new email campaign groups in the "Manage emails" menu, those newly created groups did not appear in the dropdown on the compose email page. This was caused by React Query's caching behavior with the global `staleTime` of 60 seconds.

## Root Cause
1. **Global Cache Configuration**: The React Query provider had `staleTime: 60 * 1000` (60 seconds) and `refetchOnWindowFocus: false` configured globally in `/src/app/provider.tsx`
2. **Cache Invalidation Timing**: When a new group was created on the "Manage emails" page, the cache was updated and queries were invalidated. However, if the compose email page was loaded within the 60-second staleTime window, React Query would use cached data instead of refetching
3. **Inactive Query Behavior**: The `invalidateQueries` call only affected active queries by default, so inactive/unmounted queries wouldn't refetch until they became active again

## Solution
Implemented a multi-layered fix to ensure email groups are always up-to-date:

### 1. Compose Email Pages - Force Refetch on Mount
**Files Modified:**
- `/src/components/communication/email/BulkEmailDropdown.tsx`
- `/src/app/dashboard/compose-email-campaign/page.tsx`

**Changes:**
Added query options to always refetch fresh data:
```typescript
useQuery<EmailGroup[], Error>({
  queryKey: ["email-groups"],
  queryFn: fetchEmailGroups,
  refetchOnMount: true,      // Always refetch when component mounts
  refetchOnWindowFocus: true, // Refetch when window regains focus
});
```

### 2. Email Group Manager - Invalidate All Queries
**Files Modified:**
- `/src/components/communication/email/EmailGroupManager.tsx`
- `/src/components/communication/email/ImportGroupButtonG.tsx`

**Changes:**
Updated all query invalidations to use `refetchType: 'all'`:
```typescript
queryClient.invalidateQueries({ 
  queryKey: ["email-groups"], 
  refetchType: 'all'  // Refetch ALL queries, not just active ones
});
```

This was applied to all mutation success handlers:
- `createGroupMutation` - When creating a new group
- `renameGroupMutation` - When renaming a group
- `addEmailsMutation` - When adding emails to a group
- `removeEmailMutation` - When removing emails from a group
- `deleteGroupMutation` - When deleting a group
- `importMutation` - When importing Google groups

## How It Works

### Before Fix
1. User creates group in "Manage emails" → Cache updated → Query invalidated
2. User navigates to compose email page within 60 seconds
3. React Query sees cached data is within staleTime → Uses stale cache
4. New group doesn't appear in dropdown ❌

### After Fix
1. User creates group in "Manage emails" → Cache updated → ALL queries invalidated with `refetchType: 'all'`
2. User navigates to compose email page
3. Component mounts with `refetchOnMount: true` → Forces fresh data fetch
4. New group appears in dropdown immediately ✅

## Testing
- ✅ Build successful: `npm run build` completed without errors
- ✅ TypeScript compilation successful
- ✅ All modified files validated

## Impact
- **User Experience**: Users will now see newly created email groups immediately in all compose email dropdowns
- **Performance**: Minimal impact - only refetches when mounting compose email components or when window gains focus
- **Data Consistency**: Ensures all email group data is synchronized across all pages

## Files Changed
1. `/src/components/communication/email/BulkEmailDropdown.tsx` - Added refetch options
2. `/src/app/dashboard/compose-email-campaign/page.tsx` - Added refetch options
3. `/src/components/communication/email/EmailGroupManager.tsx` - Updated invalidation calls
4. `/src/components/communication/email/ImportGroupButtonG.tsx` - Updated invalidation call
