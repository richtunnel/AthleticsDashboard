import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
        const isOnboardingPage = pathname.startsWith("/onboarding");

        // Allow access to auth and onboarding pages without token
        if (isAuthPage || isOnboardingPage) {
          return true;
        }

        // Require token for protected routes
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/login", "/signup"],
};
