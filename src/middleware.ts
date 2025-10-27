import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware() {
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
