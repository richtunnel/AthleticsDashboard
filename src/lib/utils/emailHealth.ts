import { getResendClientOptional, isResendConfigured } from "../resend";

/**
 * Check if the email service is properly configured and functional
 */
export async function checkEmailServiceHealth(): Promise<{
  configured: boolean;
  configuredCorrectly: boolean;
  error?: string;
}> {
  const isConfigured = isResendConfigured();

  if (!isConfigured) {
    return {
      configured: false,
      configuredCorrectly: false,
      error: "RESEND_API_KEY environment variable is not set",
    };
  }

  const resend = getResendClientOptional();
  if (!resend) {
    return {
      configured: false,
      configuredCorrectly: false,
      error: "RESEND_API_KEY is set but has invalid format (must start with 're_')",
    };
  }

  return {
    configured: true,
    configuredCorrectly: true,
  };
}

/**
 * Get a user-friendly error message for email configuration issues
 */
export function getEmailConfigurationErrorMessage(error?: string): string {
  if (!error) {
    return "Email service is configured correctly";
  }

  if (error.includes("RESEND_API_KEY")) {
    return "Email service is not configured. Please contact support to enable email notifications.";
  }

  return `Email service configuration issue: ${error}`;
}
