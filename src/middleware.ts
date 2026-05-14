import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMemberAccessExpiresAtMs, isMemberAccessCodeDisabled, isMemberAccessToken, normalizeMemberAccessCode } from "@/lib/utils/memberAccess";
import { etagMiddleware } from "./middleware/etag-middleware";

/**
 * Cookie name for the separate parent session.
 * Must match the cookie name in parentAuthOptions.ts.
 */
const PARENT_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Secure-parent-session-token" : "parent-session-token";

/**
 * Cookie name for the separate collaborator session.
 * Must match the cookie name in collaboratorAuthOptions.ts.
 */
const COLLABORATOR_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-collaborator-session-token"
    : "collaborator-session-token";

/**
 * Try to get a token for parent routes.
 * Checks the parent cookie first, then falls back to the main cookie.
 */
async function getParentOrMainToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  // Try parent cookie first
  const parentToken = await getToken({ req, secret, cookieName: PARENT_COOKIE_NAME });
  if (parentToken?.sub) return parentToken;

  // Fall back to main cookie (for AD-as-parent case)
  const mainToken = await getToken({ req, secret });
  if (mainToken?.sub) return mainToken;

  return null;
}

/**
 * Try to get a token for dashboard / API routes.
 * Checks the main cookie first (covers ADs and legacy collaborators), then the
 * dedicated collaborator cookie (covers collaborators who signed in via the
 * isolated /api/auth/collaborator flow for same-browser session separation).
 */
async function getMainOrCollaboratorToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;

  const mainToken = await getToken({ req, secret });
  if (mainToken?.sub) return mainToken;

  const collaboratorToken = await getToken({ req, secret, cookieName: COLLABORATOR_COOKIE_NAME });
  if (collaboratorToken?.sub) return collaboratorToken;

  return null;
}

// Force Node.js runtime for middleware (Prisma doesn't work in Edge Runtime)
export const runtime = "nodejs";

export async function middleware(req: NextRequest) {
  // Generate a Request ID for better observability
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("X-Request-ID", requestId);

  // Check if this is an image request and handle ETag
  const etagResponse = etagMiddleware(req);
  if (etagResponse) {
    etagResponse.headers.set("X-Request-ID", requestId);
    return etagResponse;
  }

  // Apply security headers to all responses
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add request ID to response headers
  response.headers.set("X-Request-ID", requestId);

  // Security headers
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS header (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  // NOTE: www → non-www redirect is handled by next.config.ts `redirects()` which runs
  // BEFORE middleware. Duplicating it here with `new URL(req.url)` is dangerous — if
  // req.url's host differs from the Host header (can happen behind nginx), the redirect
  // target equals the current URL, creating an infinite redirect loop.

  // CORS handling for API routes
  const origin = req.headers.get("origin");

  const allowedOrigins = [
    "https://opletics.com",
    "https://www.opletics.com",
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000", "http://localhost:3001"] : []),
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Idempotency-Key, X-CSRF-Token");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: response.headers,
    });
  }

  const pathname = req.nextUrl.pathname;

  // ── Parent OAuth error safety net ─────────────────────────────────────────
  // When the parent OAuth callback is processed by the MAIN NextAuth handler
  // instead of the parent handler (state cookie mismatch), NextAuth redirects
  // to /login?error=OAuthCallback because the main handler has pages.error="/login".
  // Detect this by checking for any parent-auth cookie — if one exists, the
  // user was in the middle of a parent OAuth flow, so redirect them to the
  // parent sign-in page with the error intact.
  if (pathname === "/login") {
    const error = req.nextUrl.searchParams.get("error");
    if (error) {
      const isProd = process.env.NODE_ENV === "production";
      const parentStateCookie = isProd ? "__Secure-parent-next-auth.state" : "parent-next-auth.state";
      const parentCallbackCookie = isProd ? "__Secure-parent-next-auth.callback-url" : "parent-next-auth.callback-url";
      const parentCsrfCookie = isProd ? "__Host-parent-next-auth.csrf-token" : "parent-next-auth.csrf-token";

      const hasParentCookie =
        req.cookies.has(parentStateCookie) ||
        req.cookies.has(parentCallbackCookie) ||
        req.cookies.has(parentCsrfCookie);

      if (hasParentCookie) {
        const url = req.nextUrl.clone();
        url.pathname = "/onboarding/parent-signup";
        // Keep the error param so the parent signup page can surface the message
        return NextResponse.redirect(url);
      }
    }
    // No parent context — let ADs see the login page normally
    return response;
  }

  // Handle onboarding/details route with custom authentication logic
  if (pathname === "/onboarding/details") {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (!token?.sub) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding/plans";
      return NextResponse.redirect(url);
    }

    // If user is already onboarded, redirect to dashboard
    if (token.isOnboarded) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // User is in onboarding flow, allow access
    return response;
  }

  // Handle parent onboarding routes - require authentication (parent or main session)
  if (pathname.startsWith("/onboarding/parent")) {
    const token = await getParentOrMainToken(req);

    if (!token?.sub) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding/parent-signup";
      return NextResponse.redirect(url);
    }

    return response;
  }

  // Public API routes that don't require authentication (allow schools and coaches API for onboarding)
  if (
    pathname.startsWith("/api/images/optimize") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/auth/") || // NextAuth routes must be public (covers /api/auth/parent/* and /api/auth/collaborator/*)
    pathname.startsWith("/api/collaboration/accept-invitation") || // Invitation acceptance must be public
    pathname === "/api/schools" ||
    pathname === "/api/coaches"
  ) {
    return response;
  }

  // Determine if this is a parent route
  const isParentRoute = pathname.startsWith("/parent-dashboard") || pathname.startsWith("/api/parent") || pathname === "/api/calendar/list-calendars";
  const unauthRedirect = isParentRoute ? "/onboarding/parent-signup" : "/login";

  // Token resolution strategy:
  //   parent routes → parent cookie first, then main cookie
  //   all other routes → main cookie first, then collaborator cookie
  //   (collaborator cookie enables same-browser session isolation for shared devices)
  const token = isParentRoute
    ? await getParentOrMainToken(req)
    : await getMainOrCollaboratorToken(req);

  if (!token) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = unauthRedirect;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Validate token expiration
  const { exp } = token as { exp?: number | string };
  if (typeof exp === "number" && Date.now() >= exp * 1000) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = unauthRedirect;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (typeof exp === "string") {
    const expNumber = Number(exp);
    if (!Number.isNaN(expNumber) && Date.now() >= expNumber * 1000) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = unauthRedirect;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Validate member access tokens
  if (isMemberAccessToken(token)) {
    const fallbackCode = normalizeMemberAccessCode(process.env.MEMBER_ACCESS_CODE) ?? "vip.opletics.com";
    const memberCode = normalizeMemberAccessCode((token as any).memberAccessCode) ?? fallbackCode;

    if (isMemberAccessCodeDisabled(memberCode)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    const memberExpiresAtMs = getMemberAccessExpiresAtMs(token);
    if (memberExpiresAtMs && Date.now() >= memberExpiresAtMs) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Check onboarding completion for dashboard routes
  if (pathname.startsWith("/dashboard")) {
    if (!token.isOnboarded) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding/details";
      return NextResponse.redirect(url);
    }
  }

  // Check payment status for dashboard routes (except settings and account-disabled)
  if (pathname.startsWith("/dashboard")) {
    // Allow settings page and account-disabled page regardless of payment status
    if (pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/account-disabled")) {
      return response;
    }

    // Member sessions have no payment status — skip the check entirely
    if (isMemberAccessToken(token)) {
      return response;
    }

    // Check if user has overdue payment or disabled account
    if (token?.sub) {
      try {
        // Dynamically import to avoid issues with edge runtime
        const { checkPaymentStatus } = await import("@/lib/services/payment-status.service");
        const paymentStatus = await checkPaymentStatus(token.sub as string);

        // If account is disabled, redirect to account-disabled page
        if (paymentStatus.isDisabled) {
          console.log("[Middleware] Account disabled, redirecting:", token.sub);
          const url = req.nextUrl.clone();
          url.pathname = "/dashboard/account-disabled";
          return NextResponse.redirect(url);
        }

        // If payment is overdue and should lock dashboard, redirect to settings
        if (paymentStatus.shouldLockDashboard) {
          console.log("[Middleware] Payment overdue, redirecting to settings:", token.sub);
          const url = req.nextUrl.clone();
          url.pathname = "/dashboard/settings";
          url.searchParams.set("payment_overdue", "true");
          return NextResponse.redirect(url);
        }
      } catch (error) {
        console.error("[Middleware] Error checking payment status:", error);
        // On error, allow access to prevent false lockouts
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/parent-dashboard/:path*", "/api/:path*", "/onboarding/details", "/onboarding/parent/:path*"],
};
