# Security Implementation Guide

## Overview

This document outlines the comprehensive security measures implemented across the Opletics.com application to protect against common web vulnerabilities and attacks.

## Implemented Security Features

### 1. CORS (Cross-Origin Resource Sharing)

**Implementation Location:**
- `src/lib/security/security-headers.ts`
- `src/middleware.ts`
- `next.config.ts`

**Allowed Domains:**
- `https://opletics.com`
- `https://www.opletics.com`
- `https://athleticdirectorhub.com`
- `https://www.athleticdirectorhub.com`
- Development: `http://localhost:3000`, `http://localhost:3001`

**Features:**
- Strict origin validation
- Credentials support enabled
- Configurable allowed methods and headers
- Preflight request handling
- 24-hour cache max-age

### 2. Security Headers

**Implementation Location:**
- `next.config.ts` (global headers)
- `src/lib/security/security-headers.ts` (API headers)
- `src/middleware.ts` (per-request headers)

**Headers Applied:**
- **X-Frame-Options: DENY** - Prevents clickjacking
- **X-XSS-Protection: 1; mode=block** - XSS protection in older browsers
- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** - Controls referrer information
- **Permissions-Policy: camera=(), microphone=(), geolocation=()** - Restricts browser features
- **Strict-Transport-Security** - Enforces HTTPS (production only)
- **X-DNS-Prefetch-Control: on** - Controls DNS prefetching
- **Content-Security-Policy** - Comprehensive CSP for XSS prevention

**CSP Configuration:**
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com
style-src 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com
img-src 'self' data: blob: https: *.googleusercontent.com
font-src 'self' data: https://*.gstatic.com
connect-src 'self' https: wss: *.google.com *.gstatic.com *.stripe.com
frame-src 'self' https://*.google.com https://*.stripe.com
worker-src 'self' blob:
```

### 3. Rate Limiting

**Implementation Location:**
- `src/lib/security/rate-limiter.ts`

**Rate Limits by Endpoint Type:**

| Endpoint Type | Limit | Window | Purpose |
|--------------|--------|---------|---------|
| Auth endpoints | 5 requests | 15 minutes | Prevent brute force attacks |
| Password reset | 3 requests | 1 hour | Prevent abuse |
| Public API | 30 requests | 15 minutes | Protect public endpoints |
| User API | 100 requests | 15 minutes | Authenticated user limits |
| User API (strict) | 50 requests | 15 minutes | Sensitive operations |
| Games API | 60 requests | 15 minutes | Games data access |
| Calendar API | 30 requests | 15 minutes | Calendar operations |
| Email API | 10 requests | 15 minutes | Prevent spam |
| Export API | 5 requests | 1 hour | Prevent data scraping |

**Features:**
- IP-based rate limiting
- User ID-based rate limiting (when authenticated)
- Automatic cleanup of expired entries
- Configurable limits per endpoint
- Retry-After headers on 429 responses
- In-memory store (upgrade to Redis for production scaling)

**Client IP Detection:**
- Checks `x-forwarded-for` header (reverse proxy)
- Checks `x-real-ip` header
- Checks `cf-connecting-ip` (Cloudflare)
- Fallback to request IP

### 4. CSRF Protection

**Implementation Location:**
- `src/lib/security/csrf.ts`

**Features:**
- Cryptographically secure token generation (32 bytes)
- Token expiration support (default: 60 minutes)
- Constant-time comparison to prevent timing attacks
- Session-based token storage
- Automatic cleanup of expired tokens
- Configurable expiry times

**Protected Methods:**
- POST
- PUT
- PATCH
- DELETE

**Token Sources:**
- Header: `X-CSRF-Token`
- Body parameter (for form submissions)

### 5. Idempotency

**Implementation Location:**
- `src/lib/security/idempotency.ts`

**Features:**
- Prevents duplicate request processing
- Cached response replay
- Configurable expiration (default: 24 hours)
- Automatic cleanup of expired keys
- Validation of key format

**Required For:**
- Payment operations
- Charge operations
- Subscription changes
- Transfers
- Game creation/updates

**Headers:**
- Request: `Idempotency-Key`
- Response: `Idempotent-Replayed: true` (when replaying)

### 6. Input Sanitization

**Implementation Location:**
- `src/lib/security/sanitizer.ts`

**Sanitization Functions:**

| Function | Purpose |
|----------|---------|
| `sanitizeString()` | Escapes HTML special characters |
| `sanitizeObject()` | Recursive object sanitization |
| `sanitizeArray()` | Array sanitization |
| `sanitizeEmail()` | Email validation and cleaning |
| `sanitizeUrl()` | URL validation (http/https only) |
| `sanitizeForDb()` | Basic SQL pattern removal (use parameterized queries!) |
| `validatePassword()` | Password strength validation |
| `sanitizeHtml()` | Removes scripts and event handlers |
| `sanitizeFilename()` | Removes invalid characters |
| `sanitizePhone()` | Phone number validation |

**Password Strength Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Strength Levels:**
- Weak: 0-2 criteria met
- Medium: 3-4 criteria met
- Strong: 5 criteria met

### 7. SQL Injection Prevention

**Primary Defense:**
- **Prisma ORM** - All database queries use parameterized queries automatically

**Additional Measures:**
- Input sanitization functions available
- Type validation with Zod
- Never concatenate user input into queries
- Use Prisma's query builder for complex queries

### 8. XSS (Cross-Site Scripting) Prevention

**Implementation Layers:**

1. **Content Security Policy** - Restricts script sources
2. **Input Sanitization** - Escapes HTML in user input
3. **React** - Automatic XSS escaping in JSX
4. **Security Headers** - Browser protections enabled
5. **HttpOnly Cookies** - Session cookies not accessible to JS

### 9. Session Security

**Implementation Location:**
- `src/lib/utils/authOptions.ts` (NextAuth configuration)

**Features:**
- Secure cookie flags (HTTPS only in production)
- HttpOnly cookies (not accessible to JavaScript)
- SameSite cookie policy
- JWT token expiration checks
- Automatic token refresh

**Password Storage:**
- BCrypt hashing with salt rounds = 12
- Never store plain-text passwords

### 10. Cookie Security

**Configured in:**
- NextAuth session cookies
- Application cookies

**Settings:**
- `Secure: true` (production)
- `HttpOnly: true`
- `SameSite: 'strict'`
- Expiration times set appropriately

### 11. API Security Middleware

**Implementation Location:**
- `src/lib/middleware/api-security.ts`

**Features:**
- Comprehensive security wrapper for API routes
- Configurable security options
- Rate limiting integration
- CSRF protection
- Idempotency support
- Custom header support
- Standardized error responses

## Using Security Features

### Applying Rate Limiting

```typescript
import { rateLimit, RateLimitConfig, getClientIp } from '@/lib/security/rate-limiter';

export async function GET(request: NextRequest) {
  const { allowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.games
  );

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { 
        status: 429,
        headers: { 'Retry-After': retryAfter?.toString() }
      }
    );
  }

  // Your API logic here
}
```

### Applying Security Headers

```typescript
import { applyAllSecurityHeaders } from '@/lib/security/security-headers';

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ data: '...' });
  return applyAllSecurityHeaders(request, response);
}
```

### Sanitizing Input

```typescript
import { sanitizeEmail, sanitizeString, validatePassword } from '@/lib/security/sanitizer';

const email = sanitizeEmail(userInput.email);
const name = sanitizeString(userInput.name);
const passwordValidation = validatePassword(userInput.password);

if (!passwordValidation.valid) {
  return { error: passwordValidation.errors };
}
```

### Using Idempotency

```typescript
import { withIdempotency, getIdempotencyKeyFromRequest } from '@/lib/security/idempotency';

export async function POST(request: NextRequest) {
  const key = getIdempotencyKeyFromRequest(request);

  if (!key) {
    return NextResponse.json(
      { error: 'Idempotency-Key header required' },
      { status: 400 }
    );
  }

  return withIdempotency(request, async () => {
    // Your logic here (will only execute once per key)
  }, { requireKey: true });
}
```

## Best Practices

### 1. Always Use Parameterized Queries
```typescript
// ✅ GOOD - Prisma handles parameterization
await prisma.user.findUnique({
  where: { email: sanitizedEmail }
});

// ❌ BAD - Direct SQL concatenation (vulnerable)
await prisma.$queryRaw`SELECT * FROM user WHERE email = '${email}'`;
```

### 2. Validate All Inputs
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

const validated = schema.parse(body);
```

### 3. Never Expose Sensitive Data
```typescript
// ✅ GOOD - Select only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true }
});

// ❌ BAD - Returns everything including hashed password
const user = await prisma.user.findUnique({ where: { id } });
```

### 4. Use HTTPS in Production
- Always use `https://` in production
- HSTS header enforces this
- Mark cookies as `Secure`

### 5. Log Security Events
```typescript
import { logSecurityEvent } from '@/lib/middleware/api-security';

logSecurityEvent({
  type: 'rate_limit_exceeded',
  userId: session.user.id,
  ip: getClientIp(request),
  userAgent: request.headers.get('user-agent'),
  details: { endpoint: '/api/games' }
});
```

## Security Checklist

- [x] CORS configured for allowed domains
- [x] Security headers applied globally
- [x] Rate limiting implemented
- [x] CSRF protection available
- [x] Idempotency support
- [x] Input sanitization functions
- [x] Password strength validation
- [x] Prisma ORM for SQL injection prevention
- [x] Content Security Policy
- [x] Secure cookie configuration
- [x] HttpOnly session cookies
- [x] BCrypt password hashing
- [x] JWT token validation
- [x] Email enumeration prevention
- [x] Constant-time comparisons

## Production Considerations

### 1. Use Redis for Rate Limiting
Current in-memory store is fine for development. For production:
```bash
npm install ioredis
```
Update `src/lib/security/rate-limiter.ts` to use Redis.

### 2. Use Redis for CSRF Tokens
Similar to rate limiting, store tokens in Redis for horizontal scaling.

### 3. Use Redis for Idempotency
Store cached responses in Redis for persistence and scalability.

### 4. Enable CSRF for API Routes
Currently disabled for API routes (token-based auth). Consider enabling for sensitive operations.

### 5. Add Web Application Firewall
Deploy a WAF (e.g., Cloudflare, AWS WAF) for additional protection.

### 6. Regular Security Audits
- Run dependency updates: `npm audit fix`
- Check for vulnerabilities in dependencies
- Review security logs regularly
- Test with penetration testing tools

### 7. Environment Variables
Ensure these are set in production:
- `NEXTAUTH_SECRET` - Strong random string
- `DATABASE_URL` - Uses SSL
- `STRIPE_SECRET_KEY` - Live keys in production
- `NEXT_PUBLIC_APP_URL` - HTTPS

## Monitoring and Alerts

Set up alerts for:
- Rate limit breaches
- Failed authentication attempts
- Invalid CSRF tokens
- SQL injection attempt patterns
- XSS attempt patterns
- Suspicious user activity

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/security)
- [Prisma Security](https://www.prisma.io/docs/guides/performance-and-optimization/query-optimization-performance#security-considerations)
- [CORS Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## Updates

For any security updates or concerns, please update this document accordingly.
