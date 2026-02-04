/**
 * Input Sanitization Utility
 *
 * This utility provides functions to sanitize user input before storing in the database.
 * It protects against:
 * - Prototype pollution attacks via malicious keys (__proto__, constructor, prototype)
 * - XSS attacks via HTML/script injection
 * - Excessive nesting/depth that could cause performance issues
 */

// Dangerous keys that could lead to prototype pollution
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"] as const;

// Maximum allowed nesting depth for objects
const MAX_DEPTH = 10;

// Maximum allowed length for string values
const MAX_STRING_LENGTH = 10000;

// Maximum allowed number of keys in an object
const MAX_KEYS = 100;

// HTML tags and attributes that are not allowed
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers like onclick, onerror, etc.
  /<[^>]+\son\w+\s*=/gi, // HTML with event handlers
];

interface SanitizeOptions {
  maxDepth?: number;
  maxStringLength?: number;
  maxKeys?: number;
  removeDangerousKeys?: boolean;
  escapeHtml?: boolean;
}

const defaultOptions: Required<SanitizeOptions> = {
  maxDepth: MAX_DEPTH,
  maxStringLength: MAX_STRING_LENGTH,
  maxKeys: MAX_KEYS,
  removeDangerousKeys: true,
  escapeHtml: true,
};

/**
 * Checks if a key is dangerous (could lead to prototype pollution)
 */
function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.includes(key as (typeof DANGEROUS_KEYS)[number]);
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Removes XSS patterns from a string
 */
function removeXssPatterns(input: string): string {
  let sanitized = input;
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized;
}

/**
 * Sanitizes a string value
 */
function sanitizeString(value: string, options: Required<SanitizeOptions>): string {
  // Remove XSS patterns first
  let sanitized = removeXssPatterns(value);

  // Escape HTML if enabled
  if (options.escapeHtml) {
    sanitized = escapeHtml(sanitized);
  }

  // Truncate if too long
  if (sanitized.length > options.maxStringLength) {
    sanitized = sanitized.substring(0, options.maxStringLength);
  }

  return sanitized;
}

/**
 * Recursively sanitizes an object to prevent injection attacks
 */
export function sanitizeObject<T>(obj: T, depth = 0, options: SanitizeOptions = {}): T {
  const opts = { ...defaultOptions, ...options };

  // Check depth limit
  if (depth > opts.maxDepth) {
    return null as T;
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings
  if (typeof obj === "string") {
    return sanitizeString(obj, opts) as T;
  }

  // Handle numbers and booleans (pass through)
  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  // Handle dates (convert to ISO string)
  if (obj instanceof Date) {
    return obj.toISOString() as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1, opts)) as T;
  }

  // Handle objects
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj);

    // Check key count limit
    if (keys.length > opts.maxKeys) {
      console.warn(`Object has too many keys (${keys.length}), truncating to ${opts.maxKeys}`);
    }

    for (const key of keys.slice(0, opts.maxKeys)) {
      // Skip dangerous keys if option is enabled
      if (opts.removeDangerousKeys && isDangerousKey(key)) {
        console.warn(`Dangerous key "${key}" removed during sanitization`);
        continue;
      }

      // Sanitize the key itself (for keys containing HTML/script)
      const sanitizedKey = sanitizeString(key, { ...opts, maxStringLength: 255 });

      // Recursively sanitize the value
      const value = (obj as Record<string, unknown>)[key];
      result[sanitizedKey] = sanitizeObject(value, depth + 1, opts);
    }

    return result as T;
  }

  // For any other type, convert to string and sanitize
  return sanitizeString(String(obj), opts) as T;
}

/**
 * Sanitizes custom fields from CSV imports specifically
 * This is a stricter version tailored for the customFields JSON field
 */
export function sanitizeCustomFields(customFields: Record<string, unknown>): Record<string, unknown> {
  if (!customFields || typeof customFields !== "object") {
    return {};
  }

  return sanitizeObject(customFields, 0, {
    maxDepth: 5, // Shallower depth for custom fields
    maxStringLength: 5000, // Shorter strings for custom fields
    maxKeys: 50, // Fewer keys allowed
    removeDangerousKeys: true,
    escapeHtml: true,
  });
}

/**
 * Validates that a string doesn't contain dangerous patterns
 * Returns true if safe, false if dangerous patterns detected
 */
export function isSafeString(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }

  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes a column name from CSV imports
 * Ensures column names are safe to use as object keys
 */
export function sanitizeColumnName(columnName: string): string {
  if (typeof columnName !== "string") {
    return "unnamed_column";
  }

  // Trim whitespace
  let sanitized = columnName.trim();

  // Check for dangerous keys
  if (isDangerousKey(sanitized)) {
    return `column_${sanitized}`;
  }

  // Remove any control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, "");

  // Escape HTML
  sanitized = escapeHtml(sanitized);

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  // If empty after sanitization, provide a default
  if (!sanitized) {
    return "unnamed_column";
  }

  return sanitized;
}
