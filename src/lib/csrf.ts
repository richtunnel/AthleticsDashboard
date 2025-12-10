import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || "fallback-csrf-secret-change-in-production";
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a CSRF token for the current session
 */
export function generateCsrfToken(sessionId: string): string {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  
  const hash = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(data)
    .digest("hex");
  
  // Combine timestamp and hash
  return Buffer.from(`${timestamp}:${hash}`).toString("base64url");
}

/**
 * Verify a CSRF token
 */
export function verifyCsrfToken(token: string, sessionId: string, maxAge: number = 3600000): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const [timestamp, hash] = decoded.split(":");
    
    if (!timestamp || !hash) {
      return false;
    }
    
    // Check if token is expired
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > maxAge) {
      return false;
    }
    
    // Verify the hash
    const data = `${sessionId}:${timestamp}`;
    const expectedHash = crypto
      .createHmac("sha256", CSRF_SECRET)
      .update(data)
      .digest("hex");
    
    return hash === expectedHash;
  } catch (error) {
    console.error("[CSRF] Token verification error:", error);
    return false;
  }
}

/**
 * Middleware to validate CSRF tokens on state-changing requests
 */
export async function validateCsrfToken(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method;
  
  // Only validate state-changing methods
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null;
  }
  
  // Skip CSRF validation for NextAuth routes (they have their own CSRF protection)
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return null;
  }
  
  // Get session
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    // If no session, let the auth middleware handle it
    return null;
  }
  
  // Get CSRF token from header
  const csrfToken = request.headers.get("x-csrf-token");
  
  if (!csrfToken) {
    console.error("[CSRF] Missing CSRF token for", method, request.nextUrl.pathname);
    return NextResponse.json(
      { 
        success: false, 
        error: "CSRF token is required",
        code: "CSRF_TOKEN_MISSING"
      },
      { status: 403 }
    );
  }
  
  // Verify token
  const isValid = verifyCsrfToken(csrfToken, session.user.id);
  
  if (!isValid) {
    console.error("[CSRF] Invalid CSRF token for", method, request.nextUrl.pathname);
    return NextResponse.json(
      { 
        success: false, 
        error: "Invalid or expired CSRF token",
        code: "CSRF_TOKEN_INVALID"
      },
      { status: 403 }
    );
  }
  
  // Token is valid, continue
  return null;
}
