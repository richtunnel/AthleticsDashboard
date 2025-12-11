import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export interface CSRFConfig {
  cookieName?: string;
  headerName?: string;
  tokenLength?: number;
  cookieOptions?: {
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
    secure?: boolean;
    httpOnly?: boolean;
  };
}

const defaultConfig: Required<CSRFConfig> = {
  cookieName: CSRF_COOKIE_NAME,
  headerName: CSRF_HEADER_NAME,
  tokenLength: CSRF_TOKEN_LENGTH,
  cookieOptions: {
    maxAge: 60 * 60 * 24, // 24 hours
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
};

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCSRFToken(length: number = CSRF_TOKEN_LENGTH): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hashes a CSRF token for comparison
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sets a CSRF token cookie
 */
export async function setCSRFCookie(config: CSRFConfig = {}): Promise<string> {
  const mergedConfig = { ...defaultConfig, ...config };
  const token = generateCSRFToken(mergedConfig.tokenLength);
  const hashedToken = hashToken(token);
  
  const cookieStore = await cookies();
  cookieStore.set(mergedConfig.cookieName, hashedToken, {
    maxAge: mergedConfig.cookieOptions.maxAge,
    sameSite: mergedConfig.cookieOptions.sameSite,
    secure: mergedConfig.cookieOptions.secure,
    httpOnly: mergedConfig.cookieOptions.httpOnly,
    path: '/',
  });
  
  return token;
}

/**
 * Retrieves the CSRF token from cookies
 */
export async function getCSRFToken(config: CSRFConfig = {}): Promise<string | undefined> {
  const mergedConfig = { ...defaultConfig, ...config };
  const cookieStore = await cookies();
  return cookieStore.get(mergedConfig.cookieName)?.value;
}

/**
 * Validates CSRF token from request headers against stored cookie
 */
export async function validateCSRFToken(
  request: NextRequest,
  config: CSRFConfig = {}
): Promise<boolean> {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Get token from header
  const headerToken = request.headers.get(mergedConfig.headerName);
  if (!headerToken) {
    console.warn('[CSRF] No token found in request header:', mergedConfig.headerName);
    return false;
  }
  
  // Get hashed token from cookie
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(mergedConfig.cookieName)?.value;
  if (!cookieToken) {
    console.warn('[CSRF] No token found in cookie:', mergedConfig.cookieName);
    return false;
  }
  
  // Compare hashed header token with cookie token
  const hashedHeaderToken = hashToken(headerToken);
  const isValid = hashedHeaderToken === cookieToken;
  
  if (!isValid) {
    console.warn('[CSRF] Token mismatch - possible CSRF attack detected');
  }
  
  return isValid;
}

/**
 * Middleware to protect routes with CSRF validation
 * Usage: export const POST = withCSRFProtection(async (request) => { ... });
 * 
 * Supports handlers with additional parameters (e.g., for dynamic routes):
 * export const DELETE = withCSRFProtection(async (request, { params }) => { ... });
 */
export function withCSRFProtection<T extends any[] = []>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
  config: CSRFConfig = {}
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    // Skip CSRF validation for safe methods (GET, HEAD, OPTIONS)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return handler(request, ...args);
    }
    
    // Validate CSRF token
    const isValid = await validateCSRFToken(request, config);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid CSRF token. Please refresh the page and try again.' },
        { status: 403 }
      );
    }
    
    return handler(request, ...args);
  };
}

/**
 * API endpoint to get a new CSRF token
 * Add this to your API routes: /api/csrf-token
 */
export async function getCSRFTokenEndpoint(config: CSRFConfig = {}): Promise<NextResponse> {
  const token = await setCSRFCookie(config);
  return NextResponse.json({ token });
}
