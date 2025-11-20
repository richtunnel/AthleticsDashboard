import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  async function middleware(req: NextRequest & { nextauth: { token: any } }) {
    const token = req.nextauth.token;

    // Check payment status for dashboard routes (except settings)
    const pathname = req.nextUrl.pathname;
    
    // Allow settings page regardless of payment status
    if (pathname.startsWith('/dashboard/settings')) {
      return NextResponse.next();
    }

    // Check if user has overdue payment
    if (token?.sub) {
      try {
        // Dynamically import to avoid issues with edge runtime
        const { checkPaymentStatus } = await import("@/lib/services/payment-status.service");
        const paymentStatus = await checkPaymentStatus(token.sub);

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
  matcher: ["/dashboard/:path*"],
};
