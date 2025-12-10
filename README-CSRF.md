# CSRF Protection - Quick Start Guide

## ✅ CSRF Protection is Active

All state-changing API requests (POST, PUT, PATCH, DELETE) are now protected against CSRF attacks.

## How It Works

1. **Automatic Protection**: CSRF tokens are automatically generated and validated
2. **No Changes Needed**: Existing API routes work without modification
3. **Client Integration**: Use provided utilities for automatic token inclusion

## For Frontend Developers

### Option 1: Use `apiRequest` (Recommended)

```typescript
import { apiRequest } from "@/lib/utils/api-client";

// Automatically includes CSRF token and sets Content-Type
const data = await apiRequest("/api/games", {
  method: "POST",
  body: JSON.stringify({ name: "New Game" }),
});
```

### Option 2: Use `fetchWithCsrf`

```typescript
import { fetchWithCsrf } from "@/lib/utils/api-client";

const response = await fetchWithCsrf("/api/games", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "New Game" }),
});
```

### Option 3: Manual Token Access

```typescript
import { useCsrf } from "@/contexts/CsrfContext";

function MyComponent() {
  const { token, isLoading } = useCsrf();
  
  const handleSubmit = async () => {
    const response = await fetch("/api/games", {
      method: "POST",
      headers: {
        "X-CSRF-Token": token || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "New Game" }),
    });
  };
}
```

## For Backend Developers

### No Changes Required! 🎉

The middleware automatically validates CSRF tokens for all API routes.

### Routes Excluded from CSRF Validation

- `/api/auth/*` - NextAuth has its own CSRF protection
- `/api/csrf-token` - Token generation endpoint
- GET requests - Read-only operations

## Testing

```bash
# Test valid token
npm run dev

# In browser console:
const token = await fetch('/api/csrf-token').then(r => r.json()).then(d => d.token);

fetch('/api/games', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});
```

## Troubleshooting

### "CSRF token is required" Error

**Solution**: Use `fetchWithCsrf()` or `apiRequest()` instead of raw `fetch()`

### "Invalid or expired CSRF token" Error

**Solution**: Tokens expire after 1 hour. The app auto-refreshes every 30 minutes, but if you encounter this error, refresh the page.

### Token Not Available

**Solution**: Make sure `CsrfProvider` is wrapping your app (already configured in `/src/app/provider.tsx`)

## Environment Variables

```bash
# Optional: Dedicated CSRF secret
CSRF_SECRET="your-secret-key"

# Required: NextAuth secret (used as fallback)
NEXTAUTH_SECRET="your-nextauth-secret"
```

## Documentation

Full documentation: `/docs/CSRF_PROTECTION.md`

## Security Features

✅ HMAC-SHA256 token generation  
✅ Session-bound tokens  
✅ Time-limited tokens (1 hour)  
✅ Automatic token rotation (30 minutes)  
✅ Zero configuration for API routes  
✅ OWASP compliant  

---

**Questions?** See `/docs/CSRF_PROTECTION.md` for detailed information.
