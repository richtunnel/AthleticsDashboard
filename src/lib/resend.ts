import { Resend } from "resend";

/**
 * Get a Resend client instance with lazy initialization.
 * This prevents the client from being created at build time.
 *
 * @returns Resend client instance
 * @throws Error if RESEND_API_KEY is not configured
 */
export function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.error("[RESEND] RESEND_API_KEY environment variable is not set or empty");
    throw new Error("Email service is not configured. Please set RESEND_API_KEY.");
  }

  // Validate API key format (Resend keys start with "re_")
  if (!apiKey.startsWith("re_")) {
    console.warn("[RESEND] RESEND_API_KEY does not appear to be valid (should start with 're_')");
  }

  console.log("[RESEND] Creating Resend client instance");
  return new Resend(apiKey);
}

/**
 * Get a Resend client instance or null if not configured.
 * Useful for optional email functionality.
 *
 * @returns Resend client instance or null
 */
export function getResendClientOptional(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.warn("[RESEND] RESEND_API_KEY not configured, returning null");
    return null;
  }

  // Validate API key format (Resend keys start with "re_")
  if (!apiKey.startsWith("re_")) {
    console.warn("[RESEND] RESEND_API_KEY does not appear to be valid (should start with 're_')");
  }

  console.log("[RESEND] Creating optional Resend client instance");
  return new Resend(apiKey);
}

/**
 * Cached Resend client singleton for reuse within a request context.
 * Note: In serverless environments, this cache is per-container instance.
 */
let resendInstance: Resend | null = null;

/**
 * Get a cached Resend client instance (singleton pattern).
 * This reuses the same client instance within the same container/process.
 *
 * @returns Resend client instance
 * @throws Error if NEXT_PUBLIC_RESEND_API_KEY is not configured
 */
export function getResendClientCached(): Resend {
  if (!resendInstance) {
    resendInstance = getResendClient();
  }
  return resendInstance;
}
