import { NextRequest } from 'next/server';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitStore> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - IP address or user ID
   * @param limit - Max requests per window
   * @param windowMs - Time window in milliseconds
   * @returns object with allowed flag and retry time if not allowed
   */
  check(identifier: string, limit: number, windowMs: number): {
    allowed: boolean;
    retryAfter?: number;
  } {
    const now = Date.now();
    const record = this.store.get(identifier);

    if (!record || now >= record.resetTime) {
      // First request or window expired
      this.store.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { allowed: true };
    }

    if (record.count >= limit) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment count
    record.count++;
    return { allowed: true };
  }

  /**
   * Clean up expired entries from the store
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset rate limit for a specific identifier (for testing)
   */
  reset(identifier: string): void {
    this.store.delete(identifier);
  }

  /**
   * Get current count for an identifier (for debugging)
   */
  getCount(identifier: string): number {
    return this.store.get(identifier)?.count || 0;
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoint types
 */
export const RateLimitConfig = {
  // Strict limits for authentication endpoints
  auth: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  passwordReset: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 requests per hour
  
  // Moderate limits for public API endpoints
  publicApi: { limit: 30, windowMs: 15 * 60 * 1000 }, // 30 requests per 15 minutes
  
  // Higher limits for authenticated users
  userApi: { limit: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
  userApiStrict: { limit: 50, windowMs: 15 * 60 * 1000 }, // 50 requests per 15 minutes
  
  // Per-endpoint specific limits
  games: { limit: 60, windowMs: 15 * 60 * 1000 }, // 60 requests per 15 minutes
  calendar: { limit: 30, windowMs: 15 * 60 * 1000 }, // 30 requests per 15 minutes
  email: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 requests per 15 minutes
  export: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 requests per hour
};

/**
 * Extract client IP from request
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback - return a default since NextRequest doesn't have .ip
  return 'unknown';
}

/**
 * Create a rate limiter middleware for API routes
 */
export async function rateLimit(
  request: NextRequest,
  config: { limit: number; windowMs: number },
  userId?: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Use user ID if available, otherwise use IP
  const identifier = userId || getClientIp(request);
  
  return globalRateLimiter.check(identifier, config.limit, config.windowMs);
}

/**
 * Create a standardized rate limit error response
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

export { globalRateLimiter };
