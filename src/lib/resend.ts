import { Resend } from "resend";

const RESEND_API_KEY_PREFIX = "re_";

class ResendClientManager {
  private instance: Resend | null = null;
  private initialized = false;

  private validateApiKey(apiKey: string): void {
    if (!apiKey?.trim()) {
      throw new Error("RESEND_API_KEY environment variable is not set or empty");
    }

    if (!apiKey.startsWith(RESEND_API_KEY_PREFIX)) {
      throw new Error(`Invalid RESEND_API_KEY format. Expected to start with '${RESEND_API_KEY_PREFIX}'`);
    }
  }

  /**
   * Get or create a Resend client instance with lazy initialization.
   * Throws if API key is not configured.
   */
  public getClient(): Resend {
    if (!this.instance) {
      const apiKey = process.env.RESEND_API_KEY;
      this.validateApiKey(apiKey!);
      this.instance = new Resend(apiKey);
      this.initialized = true;
    }
    return this.instance;
  }

  /**
   * Get Resend client or null if not configured.
   * Useful for optional email functionality.
   */
  public getClientOptional(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey?.trim()) {
      return null;
    }

    // Validate format but don't throw
    if (!apiKey.startsWith(RESEND_API_KEY_PREFIX)) {
      console.warn("[RESEND] Invalid RESEND_API_KEY format. Expected to start with 're_'");
      return null;
    }

    if (!this.instance) {
      this.instance = new Resend(apiKey);
      this.initialized = true;
    }
    return this.instance;
  }

  /**
   * Reset the cached instance (useful for testing)
   */
  public reset(): void {
    this.instance = null;
    this.initialized = false;
  }

  /**
   * Check if client is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
const resendManager = new ResendClientManager();

/**
 * Get a Resend client instance with lazy initialization.
 * @returns Resend client instance
 * @throws Error if RESEND_API_KEY is not configured or invalid
 */
export function getResendClient(): Resend {
  return resendManager.getClient();
}

/**
 * Get a Resend client instance or null if not configured.
 * @returns Resend client instance or null
 */
export function getResendClientOptional(): Resend | null {
  return resendManager.getClientOptional();
}

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
  return resendManager.isInitialized() || !!process.env.RESEND_API_KEY;
}

/**
 * Reset Resend client (for testing)
 */
export function resetResendClient(): void {
  resendManager.reset();
}

// Export manager for advanced usage
export { resendManager };
