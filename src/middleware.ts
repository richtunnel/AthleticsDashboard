import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMemberAccessExpiresAtMs, isMemberAccessCodeDisabled, isMemberAccessToken, normalizeMemberAccessCode } from "@/lib/utils/memberAccess";
import { etagMiddleware } from "./middleware/etag-middleware";

// Force Node.js runtime for middleware (Prisma doesn't work in Edge Runtime)
export const runtime = "nodejs";

export default withAuth(
  async function middleware(req: any) {
    // Check if this is an image request and handle ETag
    const etagResponse = etagMiddleware(req);
    if (etagResponse) {
      return etagResponse;
    }

    // Apply security headers to all responses
    const response = NextResponse.next();

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

    // Redirect www to non-www
    const host = req.headers.get("host");
    if (host && host.startsWith("www.")) {
      const nonWwwHost = host.replace("www.", "");
      const newUrl = new URL(req.url);
      newUrl.host = nonWwwHost;
      return NextResponse.redirect(newUrl, 301);
    }

    // CORS handling for API routes
    const origin = req.headers.get("origin");
    const allowedOrigins = ["https://opletics.com", "https://www.opletics.com", "https://opletics.com", "https://www.opletics.com", "http://localhost:3000", "http://localhost:3001"];

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

    const token = req.nextauth?.token;

    // Check payment status for dashboard routes (except settings and account-disabled)
    const pathname = req.nextUrl.pathname;

    // Allow settings page and account-disabled page regardless of payment status
    if (pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/account-disabled")) {
      return response;
    }

    // Check if user has overdue payment or disabled account
    if (token?.sub) {
      try {
        // Dynamically import to avoid issues with edge runtime
        const { checkPaymentStatus } = await import("@/lib/services/payment-status.service");
        const paymentStatus = await checkPaymentStatus(token.sub);

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

    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        if (!token) {
          return false;
        }

        if (isMemberAccessToken(token)) {
          const fallbackCode = normalizeMemberAccessCode(process.env.MEMBER_ACCESS_CODE) ?? "vip.opletics.com";
          const memberCode = normalizeMemberAccessCode((token as any).memberAccessCode) ?? fallbackCode;

          if (isMemberAccessCodeDisabled(memberCode)) {
            return false;
          }

          const memberExpiresAtMs = getMemberAccessExpiresAtMs(token);
          if (memberExpiresAtMs && Date.now() >= memberExpiresAtMs) {
            return false;
          }
        }

        const { exp } = token as { exp?: number | string };

        if (typeof exp === "number" && Date.now() >= exp * 1000) {
          return false;
        }

        if (typeof exp === "string") {
          const expNumber = Number(exp);

          if (!Number.isNaN(expNumber) && Date.now() >= expNumber * 1000) {
            return false;
          }
        }

        return true;
      },
    },
    pages: {
      signIn: "/",
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
