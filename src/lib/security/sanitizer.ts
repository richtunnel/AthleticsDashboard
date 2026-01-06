/**
 * Input Sanitization Utilities
 * Provides functions to sanitize user input and prevent XSS attacks
 */

/**
 * Sanitize a string to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize an object recursively
 * Escapes all string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = Array.isArray(value) 
          ? sanitizeArray(value)
          : sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

/**
 * Sanitize an array recursively
 */
export function sanitizeArray<T>(arr: T[]): T[] {
  return arr.map((item: T): T => {
    if (typeof item === 'string') {
      return sanitizeString(item) as T;
    } else if (typeof item === 'object' && item !== null) {
      return (Array.isArray(item)
        ? sanitizeArray(item as unknown[])
        : sanitizeObject(item as Record<string, unknown>)) as T;
    }
    return item;
  }) as T[];
}

/**
 * Validate and sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Remove any line breaks and trim whitespace
  const sanitized = email.replace(/[\r\n]/g, '').trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Validate and sanitize a URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim();
  
  try {
    const urlObj = new URL(trimmed);
    
    // Only allow http and https protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return '';
    }
    
    // Remove javascript: and data: protocols
    if (trimmed.toLowerCase().startsWith('javascript:') || 
        trimmed.toLowerCase().startsWith('data:')) {
      return '';
    }
    
    return urlObj.href;
  } catch {
    return '';
  }
}

/**
 * Sanitize user input for database queries
 * This is NOT a replacement for parameterized queries!
 * Always use Prisma or parameterized queries for database operations
 */
export function sanitizeForDb(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous SQL patterns
  return input
    .replace(/['"]/g, '') // Remove quotes (but use parameterized queries!)
    .replace(/;|--|\n|\r/g, '') // Remove SQL comments
    .replace(/\b(OR|AND|WHERE|SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b/gi, '') // Remove SQL keywords
    .trim();
}

/**
 * Validate a password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  errors: string[];
} {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else {
    score++;
  }
  
  if (password.length >= 12) {
    score++;
  }
  
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    errors.push('Password must contain both uppercase and lowercase letters');
  }
  
  if (/\d/.test(password)) {
    score++;
  } else {
    errors.push('Password must contain at least one number');
  }
  
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++;
  } else {
    errors.push('Password must contain at least one special character');
  }
  
  if (score <= 2) {
    strength = 'weak';
  } else if (score <= 4) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }
  
  return {
    valid: errors.length === 0,
    strength,
    errors,
  };
}

/**
 * Sanitize HTML content (basic version)
 * For production, consider using a library like DOMPurify
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }
  
  // Basic HTML sanitization - remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/g, '') // Remove event handlers like onclick
    .replace(/on\w+='[^']*'/g, '')
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ''); // Remove iframes
}

/**
 * Validate a filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return '';
  }
  
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\.\./g, '') // Remove path traversal
    .replace(/^\.+/, '') // Remove leading dots
    .trim()
    .substring(0, 255); // Limit length
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }
  
  // Remove all non-numeric characters except + at the beginning
  const sanitized = phone.replace(/[^\d+]/g, '');
  
  // Basic validation: must be at least 10 digits
  const digitsOnly = sanitized.replace(/\D/g, '');
  
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return '';
  }
  
  return sanitized;
}

/**
 * Create a middleware to sanitize request body
 */
export function createSanitizerMiddleware<T extends Record<string, any>>(fields: (keyof T)[]) {
  return (body: T): T => {
    const sanitized: any = {};
    
    for (const field of fields) {
      if (field in body) {
        const value = body[field];
        
        if (typeof value === 'string') {
          sanitized[field] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
          sanitized[field] = Array.isArray(value) 
            ? sanitizeArray(value)
            : sanitizeObject(value);
        } else {
          sanitized[field] = value;
        }
      }
    }
    
    return sanitized;
  };
}
