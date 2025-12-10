import { NextRequest, NextResponse } from "next/server";
import { verifyCsrfToken } from "@/lib/csrf";

/**
 * Middleware to validate CSRF tokens on API routes
 * This runs for all /api/* routes except /api/auth/*
 */
export async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  
  // Only apply to API routes
  if (!pathname.startsWith("/api")) {
    return null;
  }
  
  // Skip NextAuth routes (they have their own CSRF protection)
  if (pathname.startsWith("/api/auth")) {
    return null;
  }
  
  // Skip CSRF token endpoint (chicken and egg problem)
  if (pathname === "/api/csrf-token") {
    return null;
  }
  
  const method = request.method;
  
  // Only validate state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null;
  }
  
  // Get CSRF token from header
  const csrfToken = request.headers.get("x-csrf-token");
  
  if (!csrfToken) {
    console.error("[CSRF Middleware] Missing CSRF token for", method, pathname);
    return NextResponse.json(
      { 
        success: false, 
        error: "CSRF token is required. Please refresh the page and try again.",
        code: "CSRF_TOKEN_MISSING"
      },
      { status: 403 }
    );
  }
  
  // For verification, we need the session ID
  // We'll extract it from the session token cookie
  const sessionToken = request.cookies.get(
    process.env.NODE_ENV === "production" 
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token"
  );
  
  if (!sessionToken?.value) {
    // If no session, the auth middleware will handle it
    return null;
  }
  
  // We'll use the session token value as the session identifier
  // In a production environment, you might want to decode the JWT to get the user ID
  const isValid = verifyCsrfToken(csrfToken, sessionToken.value);
  
  if (!isValid) {
    console.error("[CSRF Middleware] Invalid CSRF token for", method, pathname);
    return NextResponse.json(
      { 
        success: false, 
        error: "Invalid or expired CSRF token. Please refresh the page and try again.",
        code: "CSRF_TOKEN_INVALID"
      },
      { status: 403 }
    );
  }
  
  // Token is valid, continue to the API route
  return null;
}
