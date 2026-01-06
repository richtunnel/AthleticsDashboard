/**
 * API Security Middleware
 * Comprehensive security middleware for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  rateLimit,
  RateLimitConfig,
  rateLimitResponse,
} from '../security/rate-limiter';
import {
  applyAllSecurityHeaders,
  handleCorsPreflight,
  getCorsHeaders,
} from '../security/security-headers';
import {
  requiresCsrfProtection,
  csrfErrorResponse,
} from '../security/csrf';
import {
  withIdempotency,
  getIdempotencyKeyFromRequest,
} from '../security/idempotency';

/**
 * API Security Configuration
 */
export interface ApiSecurityConfig {
  /**
   * Enable CORS
   */
  cors?: boolean;

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    enabled: boolean;
    config: { limit: number; windowMs: number };
  };

  /**
   * CSRF protection
   */
  csrf?: {
    enabled: boolean;
    exemptMethods?: string[];
  };

  /**
   * Idempotency
   */
  idempotency?: {
    enabled: boolean;
    requireKey?: boolean;
  };

  /**
   * Custom security headers
   */
  customHeaders?: HeadersInit;
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: ApiSecurityConfig = {
  cors: true,
  rateLimit: {
    enabled: true,
    config: RateLimitConfig.userApi,
  },
  csrf: {
    enabled: false, // Disabled by default for API routes (token-based auth)
    exemptMethods: ['GET', 'HEAD', 'OPTIONS'],
  },
  idempotency: {
    enabled: false, // Disabled by default
    requireKey: false,
  },
  customHeaders: {},
};

/**
 * Create API security middleware
 */
export function createApiSecurityMiddleware(config: ApiSecurityConfig = {}) {
  const finalConfig: ApiSecurityConfig = {
    ...defaultSecurityConfig,
    ...config,
  };

  return async function apiSecurityMiddleware(
    request: NextRequest,
    options?: {
      userId?: string;
      csrfToken?: string;
    }
  ): Promise<{ allowed: boolean; response?: Response }> {
    // Handle CORS preflight
    if (finalConfig.cors && request.method === 'OPTIONS') {
      return {
        allowed: false,
        response: handleCorsPreflight(request),
      };
    }

    // Rate limiting
    if (finalConfig.rateLimit?.enabled) {
      const { allowed, retryAfter } = await rateLimit(
        request,
        finalConfig.rateLimit.config,
        options?.userId
      );

      if (!allowed) {
        return {
          allowed: false,
          response: rateLimitResponse(retryAfter!),
        };
      }
    }

    // CSRF protection (only for state-changing operations)
    if (finalConfig.csrf?.enabled) {
      const methodExempt = finalConfig.csrf.exemptMethods?.includes(
        request.method
      );

      if (!methodExempt && requiresCsrfProtection(request.method)) {
        const csrfToken = request.headers.get('x-csrf-token');

        if (!csrfToken || csrfToken !== options?.csrfToken) {
          return {
            allowed: false,
            response: csrfErrorResponse(),
          };
        }
      }
    }

    return { allowed: true };
  };
}

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityResponseHeaders(
  response: NextResponse,
  extraHeaders?: HeadersInit
): NextResponse {
  const headers = extraHeaders || {};

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Create a wrapper for API route handlers with security
 */
export function withApiSecurity<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  config?: ApiSecurityConfig
) {
  const securityMiddleware = createApiSecurityMiddleware(config);

  return async function securedHandler(
    request: T,
    options?: {
      userId?: string;
      csrfToken?: string;
    }
  ): Promise<NextResponse> {
    // Apply security checks
    const { allowed, response: errorResponse } = await securityMiddleware(
      request,
      options
    );

    if (!allowed) {
      return errorResponse as NextResponse;
    }

    // Execute handler
    const response = await handler(request);

    // Apply security headers
    return applySecurityResponseHeaders(response, config?.customHeaders);
  };
}

/**
 * Create a wrapper for idempotent API routes
 */
export function withIdempotentApi<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  config?: {
    rateLimit?: ApiSecurityConfig['rateLimit'];
    idempotency?: {
      enabled: boolean;
      requireKey?: boolean;
      expiryMs?: number;
    };
  }
) {
  return async function idempotentHandler(
    request: T,
    options?: {
      userId?: string;
    }
  ): Promise<NextResponse> {
    const finalConfig = config || {};

    // Apply rate limiting
    if (finalConfig.rateLimit?.enabled) {
      const { allowed, retryAfter } = await rateLimit(
        request,
        finalConfig.rateLimit.config,
        options?.userId
      );

      if (!allowed) {
        return rateLimitResponse(retryAfter!) as NextResponse;
      }
    }

    // Apply idempotency
    if (finalConfig.idempotency?.enabled) {
      return withIdempotency(request, handler, {
        expiryMs: finalConfig.idempotency.expiryMs,
        requireKey: finalConfig.idempotency.requireKey,
        userId: options?.userId,
      }) as Promise<NextResponse>;
    }

    return handler(request);
  };
}

/**
 * Validate request body against a schema
 * Zod validation should be used for complex schemas
 */
export function validateRequestBody<T>(
  body: any,
  validator: (data: any) => T
): { valid: boolean; data?: T; errors?: string[] } {
  try {
    const validated = validator(body);
    return { valid: true, data: validated };
  } catch (error: any) {
    const errors = error.errors?.map((e: any) => e.message) || ['Invalid request body'];
    return { valid: false, errors };
  }
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * Create an unauthorized error response
 */
export function unauthorizedErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Unauthorized',
      message: message || 'Authentication required',
    },
    { status: 401 }
  );
}

/**
 * Create a forbidden error response
 */
export function forbiddenErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Forbidden',
      message: message || 'You do not have permission to perform this action',
    },
    { status: 403 }
  );
}

/**
 * Create a not found error response
 */
export function notFoundErrorResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Not found',
      message: message || 'Resource not found',
    },
    { status: 404 }
  );
}

/**
 * Create a server error response
 */
export function serverErrorResponse(error?: string): NextResponse {
  return NextResponse.json(
    {
      error: 'Internal server error',
      message: error || 'An unexpected error occurred',
    },
    { status: 500 }
  );
}

/**
 * Log security events
 */
export function logSecurityEvent(event: {
  type: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
}): void {
  console.log('[SECURITY]', JSON.stringify(event));
}
