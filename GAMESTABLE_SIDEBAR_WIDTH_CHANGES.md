# GamesTable Sidebar Width Changes

## Overview
Modified the dashboard layout to increase the max-width of the content container from 1536px to 1936px when the sidebar menu is closed.

## Changes Made

### File: `src/app/dashboard/DashboardLayoutClient.tsx`

**Before:**
```tsx
<Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 }, px: { xs: 2, sm: 3 } }}>
  {children}
</Container>
```

**After:**
```tsx
<Container
  maxWidth={false}
  sx={{
    py: { xs: 2, sm: 3, md: 4 },
    px: { xs: 2, sm: 3 },
    maxWidth: {
      xs: "100%",
      sm: isSidebarVisible ? "1536px" : "1936px",
    },
    mx: "auto",
  }}
>
  {children}
</Container>
```

## Technical Details

1. **Dynamic Max-Width**: The container now responds to the sidebar state (`isSidebarVisible`)
   - When sidebar is **open**: max-width is `1536px` (matching previous "xl" breakpoint)
   - When sidebar is **closed**: max-width is `1936px` (400px wider)

2. **Responsive Design**: On mobile devices (xs breakpoint), the container uses 100% width regardless of sidebar state

3. **Center Alignment**: Added `mx: "auto"` to maintain center alignment when using custom max-width values

## Impact

- The GamesTable and all other dashboard pages will now have more horizontal space when the sidebar is closed
- This provides users with a wider view of the table data, especially useful for custom columns
- The layout smoothly transitions between widths when toggling the sidebar
- Mobile experience remains unchanged with full-width layout

## Testing Recommendations

1. Test sidebar toggle on desktop browsers
2. Verify table width increases from 1536px to 1936px when sidebar closes
3. Confirm smooth transition animations
4. Test on mobile devices to ensure responsive behavior
5. Verify all dashboard pages benefit from the increased width
