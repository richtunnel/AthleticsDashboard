/**
 * CSRF Protection Utilities
 * Implements CSRF token generation and validation
 */

import crypto from 'crypto';

/**
 * Generate a random CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token
 * In a production environment, you should store tokens in a database or Redis
 * and associate them with user sessions
 */
export function validateCsrfToken(token: string, storedToken: string): boolean {
  if (!token || !storedToken) {
    return false;
  }
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(storedToken)
  );
}

/**
 * Generate a CSRF token with expiration
 */
export function generateCsrfTokenWithExpiry(expiryMinutes: number = 60): {
  token: string;
  expiresAt: number;
} {
  return {
    token: generateCsrfToken(),
    expiresAt: Date.now() + expiryMinutes * 60 * 1000,
  };
}

/**
 * Check if CSRF token is expired
 */
export function isCsrfTokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Get CSRF token from request
 * Checks multiple locations for the token
 */
export function getCsrfTokenFromRequest(request: Request): string | null {
  // Check header first
  const headerToken = request.headers.get('x-csrf-token');
  if (headerToken) {
    return headerToken;
  }
  
  // Check for token in body (for POST requests)
  // Note: This requires parsing the body, which should be done by the handler
  
  return null;
}

/**
 * Create CSRF middleware for API routes
 * This is a simplified version - in production, integrate with your session management
 */
export class CsrfProtection {
  private tokenStore: Map<string, { token: string; expiresAt: number }> = new Map();
  private readonly expiryMinutes: number;
  
  constructor(expiryMinutes: number = 60) {
    this.expiryMinutes = expiryMinutes;
    
    // Clean up expired tokens every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Generate a new CSRF token for a session
   */
  generateToken(sessionId: string): string {
    const tokenData = generateCsrfTokenWithExpiry(this.expiryMinutes);
    this.tokenStore.set(sessionId, tokenData);
    return tokenData.token;
  }
  
  /**
   * Validate a CSRF token
   */
  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokenStore.get(sessionId);
    
    if (!stored) {
      return false;
    }
    
    if (isCsrfTokenExpired(stored.expiresAt)) {
      this.tokenStore.delete(sessionId);
      return false;
    }
    
    return validateCsrfToken(token, stored.token);
  }
  
  /**
   * Clean up expired tokens
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, tokenData] of this.tokenStore.entries()) {
      if (now > tokenData.expiresAt) {
        this.tokenStore.delete(sessionId);
      }
    }
  }
  
  /**
   * Revoke a CSRF token
   */
  revokeToken(sessionId: string): void {
    this.tokenStore.delete(sessionId);
  }
}

/**
 * Global CSRF protection instance
 * In production, integrate this with your session management
 */
export const csrfProtection = new CsrfProtection();

/**
 * Methods that require CSRF protection
 */
export const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Check if request method requires CSRF protection
 */
export function requiresCsrfProtection(method: string): boolean {
  return CSRF_PROTECTED_METHODS.includes(method.toUpperCase());
}

/**
 * Create CSRF error response
 */
export function csrfErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid or expired. Please refresh the page and try again.',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
