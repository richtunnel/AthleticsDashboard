/**
 * Stripe Configuration and Test Mode Utilities
 *
 * This module provides centralized configuration for Stripe integration
 * with support for test mode detection and test-specific features.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  standardPriceIdMo: string;
  standardPriceIdYr: string;
  teamPriceIdMo: string;
  teamPriceIdYr: string;
  plusPriceIdMo: string;
  plusPriceIdYr: string;
  isTestMode: boolean;
  testModeWarningEnabled: boolean;
}

/**
 * Determines if Stripe is running in test mode based on the secret key
 */
export function isStripeTestMode(secretKey?: string): boolean {
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
  return key?.startsWith("sk_test_") ?? false;
}

/**
 * Gets the current Stripe configuration
 */
export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const isTestMode = isStripeTestMode(secretKey);

  // Support both server-side and public environment variables for consistency
  // This ensures frontend and backend use the same price IDs
  const standardPriceIdMo = process.env.STRIPE_STANDARD_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO || "";
  const standardPriceIdYr = process.env.STRIPE_STANDARD_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR || "";
  const teamPriceIdMo = process.env.STRIPE_TEAM_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO || "";
  const teamPriceIdYr = process.env.STRIPE_TEAM_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR || "";
  const plusPriceIdMo = process.env.STRIPE_PLUS_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO || "";
  const plusPriceIdYr = process.env.STRIPE_PLUS_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR || "";

  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    standardPriceIdMo,
    standardPriceIdYr,
    teamPriceIdMo,
    teamPriceIdYr,
    plusPriceIdMo,
    plusPriceIdYr,
    isTestMode,
    testModeWarningEnabled: process.env.NODE_ENV !== "production" && isTestMode,
  };
}

/**
 * Checks if a price ID is valid (not a placeholder value)
 */
export function isValidPriceId(priceId?: string): boolean {
  if (!priceId) return false;
  if (priceId.includes("your_monthly_price_id")) return false;
  if (priceId.includes("your_annual_price_id")) return false;
  if (priceId.includes("price_your_")) return false;
  if (!priceId.startsWith("price_")) return false;
  return priceId.length > 10;
}

/**
 * Validates that all required Stripe environment variables are configured
 */
export function validateStripeConfig(): { valid: boolean; missing: string[]; invalid: string[] } {
  const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  // Check for price IDs in both server-side and public variables
  const standardPriceIdMo = process.env.STRIPE_STANDARD_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO;
  const teamPriceIdMo = process.env.STRIPE_TEAM_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO;
  const plusPriceIdMo = process.env.STRIPE_PLUS_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO;

  if (!standardPriceIdMo) {
    missing.push("STRIPE_STANDARD_PRICE_ID_MO");
  }
  if (!teamPriceIdMo) {
    missing.push("STRIPE_TEAM_PRICE_ID_MO");
  }
  if (!plusPriceIdMo) {
    missing.push("STRIPE_PLUS_PRICE_ID_MO");
  }

  const invalid: string[] = [];
  if (standardPriceIdMo && !isValidPriceId(standardPriceIdMo)) {
    invalid.push("STRIPE_STANDARD_PRICE_ID_MO");
  }
  if (teamPriceIdMo && !isValidPriceId(teamPriceIdMo)) {
    invalid.push("STRIPE_TEAM_PRICE_ID_MO");
  }
  if (plusPriceIdMo && !isValidPriceId(plusPriceIdMo)) {
    invalid.push("STRIPE_PLUS_PRICE_ID_MO");
  }

  if (missing.length > 0) {
    console.warn(`⚠️  Missing Stripe environment variables: ${missing.join(", ")}\n` + `Subscription features will not work correctly.`);
  }

  if (invalid.length > 0) {
    console.warn(`⚠️  Invalid Stripe environment variables (placeholder values detected): ${invalid.join(", ")}\n` + `Please update these with actual Price IDs from your Stripe dashboard.`);
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Validates client-side Stripe configuration (for use in components)
 */
export function validateClientStripeConfig(): { valid: boolean; missing: string[]; invalid: string[] } {
  const required = [
    "NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO",
    "NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO",
    "NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO"
  ];

  const missing: string[] = [];
  const invalid: string[] = [];

  if (typeof window !== "undefined") {
    required.forEach(key => {
      const value = process.env[key];
      if (!value) {
        missing.push(key);
      } else if (!isValidPriceId(value)) {
        invalid.push(key);
      }
    });

    if (missing.length > 0 || invalid.length > 0) {
      console.warn(
        "⚠️  Stripe configuration issues:\n" +
          (missing.length > 0 ? `Missing: ${missing.join(", ")}\n` : "") +
          (invalid.length > 0 ? `Invalid/Placeholder: ${invalid.join(", ")}\n` : "") +
          "See docs/STRIPE_QUICK_START.md for setup instructions."
      );
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Test card numbers for different scenarios
 * Reference: https://stripe.com/docs/testing
 */
export const TEST_CARDS = {
  success: "4242424242424242",
  visa: "4242424242424242",
  visa_debit: "4000056655665556",
  mastercard: "5555555555554444",
  amex: "378282246310005",
  decline: "4000000000000002",
  insufficient_funds: "4000000000009995",
  lost_card: "4000000000009987",
  stolen_card: "4000000000009979",
  expired_card: "4000000000000069",
  incorrect_cvc: "4000000000000127",
  processing_error: "4000000000000119",
  requires_authentication: "4000002500003155",
} as const;

/**
 * Gets test mode metadata to attach to Stripe objects
 * This helps identify test transactions in the Stripe dashboard
 */
export function getTestModeMetadata(additionalMetadata: Record<string, string> = {}) {
  const config = getStripeConfig();

  if (!config.isTestMode) {
    return additionalMetadata;
  }

  return {
    ...additionalMetadata,
    test_mode: "true",
    test_environment: process.env.NODE_ENV ?? "development",
    test_timestamp: new Date().toISOString(),
  };
}

/**
 * Logs test mode information for debugging
 */
export function logTestModeInfo(context: string, data?: Record<string, any>) {
  const config = getStripeConfig();

  if (!config.isTestMode) {
    return;
  }

  console.log(`[Stripe Test Mode] ${context}`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Returns test-mode-specific configuration for checkout sessions
 */
export function getTestModeCheckoutOptions() {
  const config = getStripeConfig();

  if (!config.isTestMode) {
    return {};
  }

  // In test mode, we can add helpful features like pre-filled email
  return {
    // Allow promotion codes in test mode for easier testing
    allow_promotion_codes: true,
  };
}

/**
 * Gets trial period configuration
 * Can be overridden in test mode for faster testing
 */
export function getTrialPeriodDays(): number {
  const config = getStripeConfig();

  // In test mode, you can reduce trial period for faster testing
  // Set STRIPE_TEST_TRIAL_DAYS or STRIPE_TEST_TRIAL_DAY to override the default 14 days
  const trialDaysEnv = process.env.STRIPE_TEST_TRIAL_DAYS || process.env.STRIPE_TEST_TRIAL_DAY;
  
  if (config.isTestMode && trialDaysEnv) {
    const testDays = parseInt(trialDaysEnv, 10);
    if (!isNaN(testDays) && testDays > 0) {
      console.log(`[Stripe Test Mode] Using ${testDays}-day trial period for testing`);
      return testDays;
    }
  }

  return 14; // Default trial period
}
