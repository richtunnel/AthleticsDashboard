/**
 * Production-safe logging utility
 * Automatically disables non-error logs in production
 */

const isProduction = process.env.NODE_ENV === "production";

interface LogContext {
  [key: string]: any;
}

export const logger = {
  /**
   * Log debug information (disabled in production)
   */
  debug: (message: string, context?: LogContext) => {
    if (!isProduction) {
      console.log(`[DEBUG] ${message}`, context || "");
    }
  },

  /**
   * Log general information (disabled in production)
   */
  info: (message: string, context?: LogContext) => {
    if (!isProduction) {
      console.info(`[INFO] ${message}`, context || "");
    }
  },

  /**
   * Log warnings (enabled in production)
   */
  warn: (message: string, context?: LogContext) => {
    console.warn(`[WARN] ${message}`, context || "");
  },

  /**
   * Log errors (always enabled)
   */
  error: (message: string, context?: LogContext) => {
    console.error(`[ERROR] ${message}`, context || "");
  },

  /**
   * Log performance metrics (disabled in production)
   */
  perf: (label: string, duration: number) => {
    if (!isProduction) {
      console.log(`[PERF] ${label}: ${duration}ms`);
    }
  },
};

export default logger;