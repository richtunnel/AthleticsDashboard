/**
 * Request guard helpers for middleware: scanner-path detection and
 * rate-limit tiering. Kept pure (no Redis import) so it's cheap to evaluate on
 * every request and easy to unit test.
 */

/**
 * Paths that only automated scanners / sniffers request. A legitimate browser
 * or our own frontend never hits these. We answer with an instant 404 so we
 * don't waste a Redis round-trip or leak framework details.
 */
const SCANNER_PATTERNS: RegExp[] = [
  /^\/\.env/i, // .env, .env.local, .env.production
  /^\/\.git/i, // .git/config, .git/HEAD
  /^\/\.aws/i,
  /^\/\.ssh/i,
  /\/wp-(login|admin|content|includes)/i, // WordPress probes
  /^\/(xmlrpc|wlwmanifest)\.php/i,
  /\.(php|asp|aspx|jsp|cgi)$/i, // we have no PHP/ASP/JSP endpoints
  /^\/(phpmyadmin|pma|adminer|mysql)/i,
  /^\/(vendor|composer\.(json|lock))/i,
  /^\/(config|backup|dump|db)\.(sql|zip|tar|gz|bak)$/i,
  /^\/(actuator|console|solr|jenkins)/i,
  /^\/\.well-known\/.*\.(php|env)/i,
];

export function isScannerPath(pathname: string): boolean {
  return SCANNER_PATTERNS.some((re) => re.test(pathname));
}

export interface RateTier {
  bucket: string; // short label used in the Redis key + logs
  limit: number; // max requests per window
  windowSec: number; // window length in seconds
}

/**
 * Classify a request path into a rate-limit tier. Returns null when the path
 * should NOT be rate limited (e.g. Stripe webhooks, which Stripe may burst).
 *
 * Limits are generous enough that no real user hits them, but low enough that
 * a scanner or scraper trips them quickly.
 */
export function getRateTier(pathname: string, method: string): RateTier | null {
  // ── Never throttle inbound webhooks — Stripe retries and bursts legitimately
  if (pathname.startsWith("/api/stripe/webhook")) return null;

  // ── Auth surface: brute-force target. Strict. Only count state-changing POSTs
  //    so polling the NextAuth session endpoint (GET) isn't throttled.
  // Note: /api/user/exists is intentionally NOT here — the signup form polls it
  // while the user types their email, and it already has its own limiter. It
  // falls through to the general /api tier below.
  const isAuthSurface =
    pathname.startsWith("/api/auth/callback/credentials") || // password login POST — brute-force target
    pathname.startsWith("/api/auth/google-login") ||
    pathname.startsWith("/api/auth/google-signup") ||
    pathname === "/api/signup" ||
    pathname.includes("/password") ||
    pathname.includes("/reset");

  if (isAuthSurface && method !== "GET") {
    return { bucket: "auth", limit: 10, windowSec: 60 }; // 10/min/IP
  }

  // ── Everything else under /api — moderate per-IP ceiling. Real dashboards
  //    make many calls, so this is high; scanners sweeping endpoints still trip it.
  if (pathname.startsWith("/api/")) {
    return { bucket: "api", limit: 200, windowSec: 60 }; // 200/min/IP
  }

  return null; // non-API paths aren't rate limited here
}

/**
 * Extract the best-guess client IP from proxy headers. Mirrors the logic in
 * rate-limiter.ts but works off a plain Headers object.
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "unknown";
}
