# Material UI + Emotion SSR Configuration

## Overview

This application uses **Material UI v7** with **Emotion** for styling in a **Next.js 15 App Router** environment. Proper SSR (Server-Side Rendering) configuration is critical to prevent:

- ❌ FOUC (Flash of Unstyled Content)
- ❌ Style hydration mismatches
- ❌ Performance issues
- ❌ CSS injection order problems

## Implementation

### 1. AppRouterCacheProvider

We use MUI's official `@mui/material-nextjs` integration package to handle Emotion cache during SSR.

**File:** `src/app/theme-provider.tsx`

```tsx
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";

export function MUIThemeProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", prepend: true }}>
      <ThemeProvider theme={lightTheme}>
        {/* ... */}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

### 2. Emotion Cache Configuration

**File:** `src/lib/emotionCache.ts`

```tsx
import createCache from "@emotion/cache";

export function createEmotionCache() {
  return createCache({
    key: "mui",        // Cache key prefix for generated classnames
    prepend: true,     // Inject styles at the beginning of <head> for easier overriding
  });
}
```

### 3. Provider Hierarchy

The complete provider hierarchy in `src/app/layout.tsx`:

```
RootLayout
└── Providers (client component)
    └── MUIThemeProvider (client component)
        └── AppRouterCacheProvider (handles SSR style extraction)
            └── ThemeProvider (MUI theme)
                └── SessionProvider
                    └── QueryClientProvider
                        └── {children}
```

## How It Works

### Server-Side Rendering (SSR)

1. **During SSR**: `AppRouterCacheProvider` creates an Emotion cache and extracts all styles generated during rendering
2. **Style Injection**: The extracted styles are injected into the `<head>` of the HTML document
3. **Hydration**: On the client side, React hydrates with the same styles, preventing mismatches

### Cache Options

- **`key: "mui"`**: Prefixes all generated CSS class names with `mui-` for easy identification
- **`prepend: true`**: Injects MUI styles at the beginning of `<head>`, allowing your custom styles to take precedence

## Pages Router vs App Router

| Feature | Pages Router | App Router (Current) |
|---------|--------------|---------------------|
| Document file | `pages/_document.tsx` | Not needed |
| Integration package | `@mui/material-nextjs/v14-pagesRouter` | `@mui/material-nextjs/v15-appRouter` |
| Cache provider | Manual `DocumentHeadTags` + `documentGetInitialProps` | `AppRouterCacheProvider` |
| Setup complexity | Higher (requires custom Document) | Lower (handled by provider) |

## Dependencies

```json
{
  "@emotion/cache": "^11.14.0",
  "@emotion/react": "^11.14.0",
  "@emotion/styled": "^11.14.1",
  "@mui/material": "^7.3.4",
  "@mui/material-nextjs": "^7.3.3"
}
```

## Verification

To verify SSR is working correctly:

1. **View Page Source**: Right-click → "View Page Source" (not Inspect Element)
2. **Check `<head>`**: Look for `<style data-emotion="mui">` tags with CSS rules
3. **No FOUC**: The page should render with styles immediately, no flash of unstyled content

## Troubleshooting

### Problem: Styles flash on page load

**Solution**: Ensure `AppRouterCacheProvider` wraps `ThemeProvider` and is marked as `"use client"`

### Problem: CSS class name mismatches in console

**Solution**: Verify the cache `key` option matches between server and client (should be `"mui"`)

### Problem: Custom styles not overriding MUI styles

**Solution**: Use `prepend: true` option to inject MUI styles first, or increase CSS specificity

## References

- [MUI Next.js Integration - App Router](https://mui.com/material-ui/integrations/nextjs/)
- [Emotion Cache Configuration](https://emotion.sh/docs/@emotion/cache)
- [Next.js 15 App Router Documentation](https://nextjs.org/docs/app)
