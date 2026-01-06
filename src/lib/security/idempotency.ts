/**
 * Idempotency Utilities
 * Prevents duplicate processing of the same request
 */

import crypto from 'crypto';

interface IdempotencyKeyRecord {
  statusCode: number;
  body: any;
  createdAt: number;
  expiresAt: number;
}

class IdempotencyStore {
  private cache: Map<string, IdempotencyKeyRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly defaultExpiryMs: number;

  constructor(defaultExpiryMs: number = 24 * 60 * 60 * 1000) {
    this.defaultExpiryMs = defaultExpiryMs;

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if an idempotency key has been used before
   */
  check(key: string): IdempotencyKeyRecord | null {
    const record = this.cache.get(key);

    if (!record) {
      return null;
    }

    if (Date.now() > record.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Store a response for an idempotency key
   */
  setCache(key: string, statusCode: number, body: any, expiryMs?: number): void {
    const expiresAt = Date.now() + (expiryMs || this.defaultExpiryMs);

    this.cache.set(key, {
      statusCode,
      body,
      createdAt: Date.now(),
      expiresAt,
    });
  }

  /**
   * Delete an idempotency key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get all keys for debugging
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get store size
   */
  size(): number {
    return this.cache.size;
  }
}

// Global idempotency store instance
const globalIdempotencyStore = new IdempotencyStore();

/**
 * Generate a secure idempotency key if not provided
 */
export function generateIdempotencyKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKeyFromRequest(request: Request): string | null {
  const key = request.headers.get('Idempotency-Key');
  return key?.trim() || null;
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  // Keys should be at least 16 characters and not contain special chars that could cause issues
  if (typeof key !== 'string') {
    return false;
  }
  
  if (key.length < 16 || key.length > 255) {
    return false;
  }
  
  // Allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9\-_]+$/.test(key);
}

/**
 * Create an idempotency key from user ID and operation
 */
export function createOperationKey(userId: string, operation: string): string {
  const timestamp = Date.now();
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}:${operation}:${timestamp}`)
    .digest('hex')
    .substring(0, 32);
  
  return hash;
}

/**
 * Idempotency middleware for API routes
 * Returns cached response if idempotency key was used before
 */
export function withIdempotency<T extends Request>(
  request: T,
  handler: (request: T) => Promise<Response>,
  options?: {
    expiryMs?: number;
    requireKey?: boolean;
    userId?: string;
  }
): Promise<Response> {
  return new Promise(async (resolve, reject) => {
    try {
      const key = getIdempotencyKeyFromRequest(request);
      
      if (key) {
        // Validate key format
        if (!isValidIdempotencyKey(key)) {
          resolve(new Response(
            JSON.stringify({
              error: 'Invalid idempotency key',
              message: 'Idempotency key must be 16-255 alphanumeric characters',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          ));
          return;
        }
        
        // Check if we've already processed this key
        const cached = globalIdempotencyStore.check(key);
        
        if (cached) {
          // Return cached response
          resolve(new Response(JSON.stringify(cached.body), {
            status: cached.statusCode,
            headers: {
              'Content-Type': 'application/json',
              'Idempotent-Replayed': 'true',
            },
          }));
          return;
        }
      } else if (options?.requireKey) {
        // Idempotency key is required but not provided
        resolve(new Response(
          JSON.stringify({
            error: 'Missing idempotency key',
            message: 'This operation requires an Idempotency-Key header',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        ));
        return;
      }
      
      // Execute the handler
      const response = await handler(request);

      // Store the response if an idempotency key was provided and response was successful
      if (key && response.ok) {
        try {
          const body = await response.clone().json();
          globalIdempotencyStore.setCache(
            key,
            response.status,
            body,
            options?.expiryMs
          );
        } catch (error) {
          // Failed to parse JSON, don't cache
          console.error('Failed to cache idempotent response:', error);
        }
      }

      resolve(response);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Operations that should require idempotency keys
 */
export const IDEMPOTENT_REQUIRED_OPERATIONS = [
  'payment',
  'charge',
  'subscription',
  'transfer',
  'create-game',
  'update-game',
];

/**
 * Check if an operation requires idempotency
 */
export function operationRequiresIdempotency(operation: string): boolean {
  return IDEMPOTENT_REQUIRED_OPERATIONS.some(op => 
    operation.toLowerCase().includes(op)
  );
}

/**
 * Create an idempotency error response
 */
export function idempotencyErrorResponse(originalResponse: Response): Response {
  return new Response(
    JSON.stringify({
      error: 'Conflict',
      message: 'This request has already been processed',
      originalStatus: originalResponse.status,
    }),
    {
      status: 409,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export { globalIdempotencyStore };
