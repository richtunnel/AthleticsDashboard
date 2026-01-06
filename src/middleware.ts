import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getMemberAccessExpiresAtMs,
  isMemberAccessCodeDisabled,
  isMemberAccessToken,
  normalizeMemberAccessCode,
} from "@/lib/utils/memberAccess";

// Force Node.js runtime for middleware (Prisma doesn't work in Edge Runtime)
export const runtime = 'nodejs';

export default withAuth(
  async function middleware(req: any) {
    // Redirect www to non-www
    const host = req.headers.get('host');
    if (host && host.startsWith('www.')) {
      const nonWwwHost = host.replace('www.', '');
      const newUrl = new URL(req.url);
      newUrl.host = nonWwwHost;
      return NextResponse.redirect(newUrl, 301);
    }

    const token = req.nextauth?.token;

    // Check payment status for dashboard routes (except settings and account-disabled)
    const pathname = req.nextUrl.pathname;
    
    // Allow settings page and account-disabled page regardless of payment status
    if (pathname.startsWith('/dashboard/settings') || pathname.startsWith('/dashboard/account-disabled')) {
      return NextResponse.next();
    }

    // Check if user has overdue payment or disabled account
    if (token?.sub) {
      try {
        // Dynamically import to avoid issues with edge runtime
        const { checkPaymentStatus } = await import("@/lib/services/payment-status.service");
        const paymentStatus = await checkPaymentStatus(token.sub);

        // If account is disabled, redirect to account-disabled page
        if (paymentStatus.isDisabled) {
          console.log('[Middleware] Account disabled, redirecting:', token.sub);
          const url = req.nextUrl.clone();
          url.pathname = '/dashboard/account-disabled';
          return NextResponse.redirect(url);
        }

        // If payment is overdue and should lock dashboard, redirect to settings
        if (paymentStatus.shouldLockDashboard) {
          console.log('[Middleware] Payment overdue, redirecting to settings:', token.sub);
          const url = req.nextUrl.clone();
          url.pathname = '/dashboard/settings';
          url.searchParams.set('payment_overdue', 'true');
          return NextResponse.redirect(url);
        }
      } catch (error) {
        console.error('[Middleware] Error checking payment status:', error);
        // On error, allow access to prevent false lockouts
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        if (!token) {
          return false;
        }

        if (isMemberAccessToken(token)) {
          const fallbackCode = normalizeMemberAccessCode(process.env.MEMBER_ACCESS_CODE) ?? "opletics25";
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
