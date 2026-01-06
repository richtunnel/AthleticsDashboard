# Security Library

This directory contains comprehensive security utilities for the Opletics application.

## Modules

### rate-limiter.ts
Implements in-memory rate limiting with support for IP and user ID-based limiting.

**Key Functions:**
- `rateLimit(request, config, userId)` - Check if request should be rate limited
- `getClientIp(request)` - Extract client IP from request headers
- `rateLimitResponse(retryAfter)` - Create standardized 429 response

**Usage:**
```typescript
import { rateLimit, RateLimitConfig } from '@/lib/security/rate-limiter';

const { allowed, retryAfter } = await rateLimit(
  request,
  RateLimitConfig.auth
);

if (!allowed) {
  return rateLimitResponse(retryAfter);
}
```

### security-headers.ts
Comprehensive security headers and CORS configuration.

**Key Functions:**
- `getApiSecurityHeaders()` - Get standard security headers
- `getCorsHeaders(origin)` - Get CORS headers for request
- `handleCorsPreflight(request)` - Handle OPTIONS requests
- `applyAllSecurityHeaders(request, response, extraHeaders)` - Apply all headers

**Usage:**
```typescript
import { applyAllSecurityHeaders } from '@/lib/security/security-headers';

const response = NextResponse.json({ data });
return applyAllSecurityHeaders(request, response);
```

### csrf.ts
CSRF (Cross-Site Request Forgery) protection.

**Key Functions:**
- `generateCsrfToken()` - Generate secure random token
- `validateCsrfToken(token, storedToken)` - Validate token with constant-time comparison
- `getCsrfTokenFromRequest(request)` - Extract token from headers

**Usage:**
```typescript
import { csrfProtection } from '@/lib/security/csrf';

// Generate token for session
const token = csrfProtection.generateToken(sessionId);

// Validate token
const isValid = csrfProtection.validateToken(sessionId, token);
```

### idempotency.ts
Prevents duplicate processing of requests.

**Key Functions:**
- `withIdempotency(request, handler, options)` - Wrap handler with idempotency
- `generateIdempotencyKey()` - Generate unique idempotency key
- `getIdempotencyKeyFromRequest(request)` - Extract from `Idempotency-Key` header

**Usage:**
```typescript
import { withIdempotency } from '@/lib/security/idempotency';

export async function POST(request: NextRequest) {
  return withIdempotency(request, async () => {
    // This will only execute once per idempotency key
    return await processPayment();
  });
}
```

### sanitizer.ts
Input sanitization and validation utilities.

**Key Functions:**
- `sanitizeString(input)` - Escape HTML special characters
- `sanitizeEmail(email)` - Validate and clean email
- `sanitizeUrl(url)` - Validate URL (http/https only)
- `validatePassword(password)` - Check password strength
- `sanitizeHtml(html)` - Remove scripts and dangerous tags

**Usage:**
```typescript
import { sanitizeEmail, sanitizeString, validatePassword } from '@/lib/security/sanitizer';

const email = sanitizeEmail(userInput.email);
const name = sanitizeString(userInput.name);
const passwordCheck = validatePassword(userInput.password);

if (!passwordCheck.valid) {
  return { errors: passwordCheck.errors };
}
```

## Security Best Practices

### 1. Always Sanitize User Input
Never trust user input. Always sanitize before processing.

### 2. Use Parameterized Queries
Prisma handles this automatically. Never concatenate user input into queries.

### 3. Apply Security Headers
Use `applyAllSecurityHeaders()` on all API responses.

### 4. Rate Limit Public Endpoints
Protect against abuse and DoS attacks.

### 5. Validate on Both Client and Server
Client validation is for UX, server validation is for security.

### 6. Never Log Sensitive Data
Don't log passwords, tokens, or other sensitive information.

### 7. Use Constant-Time Comparisons
For security tokens and passwords to prevent timing attacks.

### 8. Enable HTTPS in Production
Always use HTTPS with valid certificates.

### 9. Keep Dependencies Updated
Regularly update dependencies for security patches.

### 10. Implement Proper Error Handling
Don't expose internal implementation details in error messages.

## Testing Security

### Rate Limiting Test
```bash
# Run multiple requests to test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test"}'
done
```

### CORS Test
```bash
# Test CORS headers
curl -X OPTIONS http://localhost:3000/api/games \
  -H "Origin: https://opletics.com" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

### Security Headers Test
```bash
# Check security headers
curl -I http://localhost:3000/api/games
```

### Idempotency Test
```bash
# Send same request twice with same idempotency key
curl -X POST http://localhost:3000/api/payment \
  -H "Idempotency-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"amount":100}'
```

## Production Deployment

Before deploying to production:

1. **Generate strong secrets**
   ```bash
   openssl rand -base64 32
   ```

2. **Update CORS origins**
   - Remove localhost
   - Add production domains only

3. **Enable HSTS**
   - Ensure SSL certificate is valid
   - Add `Strict-Transport-Security` header

4. **Review CSP**
   - Tighten content sources
   - Remove `unsafe-inline` where possible

5. **Monitor logs**
   - Set up security alerts
   - Monitor for suspicious activity

6. **Consider Redis**
   - For rate limiting persistence
   - For CSRF token storage
   - For idempotency cache

## Security Headers Reference

| Header | Purpose | Value |
|---------|---------|--------|
| X-Frame-Options | Prevent clickjacking | DENY |
| X-XSS-Protection | XSS protection | 1; mode=block |
| X-Content-Type-Options | Prevent MIME sniffing | nosniff |
| Referrer-Policy | Control referrer info | strict-origin-when-cross-origin |
| Permissions-Policy | Restrict features | camera=(), microphone=(), geolocation=() |
| Strict-Transport-Security | Enforce HTTPS | max-age=63072000; includeSubDomains; preload |
| Content-Security-Policy | Prevent XSS | See implementation |

## Support

For security issues or questions, please review:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Next.js Security Docs](https://nextjs.org/docs/security)
