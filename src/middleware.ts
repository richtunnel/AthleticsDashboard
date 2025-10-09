// Middleware that prevents required authorization like login

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Bypass auth in development
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // In production, check for auth (implement your auth logic here)
  const token = request.cookies.get("next-auth.session-token");

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/api/auth/signin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
