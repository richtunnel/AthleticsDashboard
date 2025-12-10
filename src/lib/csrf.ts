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
