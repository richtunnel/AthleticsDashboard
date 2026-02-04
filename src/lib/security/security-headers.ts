/**
 * Security Headers Utilities
 * Implements comprehensive security headers for Next.js applications
 */

/**
 * Default security headers configuration
 */
export const defaultSecurityHeaders = {
  // Prevent clickjacking attacks
  "X-Frame-Options": "DENY",

  // Enable XSS protection
  "X-XSS-Protection": "1; mode=block",

  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Referrer policy for privacy
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Permissions policy (formerly Feature Policy)
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",

  // Content Security Policy (basic)
  // This should be enhanced in next.config.ts for production
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com; script-src-elem 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com; style-src 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com; img-src 'self' data: blob: https:; font-src 'self' data: https://*.gstatic.com; connect-src 'self' https: *.google.com *.gstatic.com *.googletagmanager.com; frame-src 'self' https://*.google.com;",

  // Strict Transport Security (HSTS)
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

/**
 * Get security headers for API responses
 */
export function getApiSecurityHeaders(): HeadersInit {
  return {
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

/**
 * CORS configuration for API routes
 */
export const corsConfig = {
  allowedOrigins: [
    // Production domains
    "https://opletics.com",
    "https://www.opletics.com",
    "https://opletics.com",
    "https://www.opletics.com",

    // Development domains
    "http://localhost:3000",
    "http://localhost:3001",

    // Add your staging/other environments here
    // 'https://staging.opletics.com',
  ],

  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Idempotency-Key", "X-CSRF-Token"],

  exposedHeaders: [],

  allowCredentials: true,

  maxAge: 86400, // 24 hours
};

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    return true;
  }

  const allowedOrigins = corsConfig.allowedOrigins;
  return allowedOrigins.includes(origin);
}

/**
 * Create CORS headers for a response
 */
export function getCorsHeaders(requestOrigin?: string | null): HeadersInit {
  const headers: HeadersInit = {};

  if (requestOrigin && isOriginAllowed(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  } else if (!requestOrigin) {
    // For same-origin requests or those without origin header
    headers["Access-Control-Allow-Origin"] = "*";
  }

  headers["Access-Control-Allow-Methods"] = corsConfig.allowedMethods.join(", ");
  headers["Access-Control-Allow-Headers"] = corsConfig.allowedHeaders.join(", ");
  headers["Access-Control-Max-Age"] = corsConfig.maxAge.toString();

  if (corsConfig.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(request: Request): Response {
  const origin = request.headers.get("origin");
  const headers = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(response: Response, extraHeaders: HeadersInit = {}): Response {
  const securityHeaders = {
    ...getApiSecurityHeaders(),
    ...extraHeaders,
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Apply CORS headers to a NextResponse
 */
export function applyCorsHeaders(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Apply both security and CORS headers
 */
export function applyAllSecurityHeaders(request: Request, response: Response, extraHeaders: HeadersInit = {}): Response {
  response = applySecurityHeaders(response, extraHeaders);
  response = applyCorsHeaders(request, response);
  return response;
}
