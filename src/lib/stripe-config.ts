/**
 * Stripe Configuration and Test Mode Utilities
 * 
 * This module provides centralized configuration for Stripe integration
 * with support for test mode detection and test-specific features.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  annualPriceId: string;
  isTestMode: boolean;
  testModeWarningEnabled: boolean;
}

/**
 * Determines if Stripe is running in test mode based on the secret key
 */
export function isStripeTestMode(secretKey?: string): boolean {
  const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
  return key?.startsWith('sk_test_') ?? false;
}

/**
 * Gets the current Stripe configuration
 */
export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? '';
  const isTestMode = isStripeTestMode(secretKey);

  return {
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID ?? '',
    annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID ?? '',
    isTestMode,
    testModeWarningEnabled: process.env.NODE_ENV !== 'production' && isTestMode,
  };
}

/**
 * Validates that all required Stripe environment variables are configured
 */
export function validateStripeConfig(): { valid: boolean; missing: string[] } {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_MONTHLY_PRICE_ID',
    'STRIPE_ANNUAL_PRICE_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing Stripe environment variables: ${missing.join(', ')}\n` +
      `Subscription features will not work correctly.`
    );
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Test card numbers for different scenarios
 * Reference: https://stripe.com/docs/testing
 */
export const TEST_CARDS = {
  success: '4242424242424242',
  visa: '4242424242424242',
  visa_debit: '4000056655665556',
  mastercard: '5555555555554444',
  amex: '378282246310005',
  decline: '4000000000000002',
  insufficient_funds: '4000000000009995',
  lost_card: '4000000000009987',
  stolen_card: '4000000000009979',
  expired_card: '4000000000000069',
  incorrect_cvc: '4000000000000127',
  processing_error: '4000000000000119',
  requires_authentication: '4000002500003155',
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
    test_mode: 'true',
    test_environment: process.env.NODE_ENV ?? 'development',
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
  // Set STRIPE_TEST_TRIAL_DAYS to override the default 14 days
  if (config.isTestMode && process.env.STRIPE_TEST_TRIAL_DAYS) {
    const testDays = parseInt(process.env.STRIPE_TEST_TRIAL_DAYS, 10);
    if (!isNaN(testDays) && testDays > 0) {
      console.log(`[Stripe Test Mode] Using ${testDays}-day trial period for testing`);
      return testDays;
    }
  }

  return 14; // Default trial period
}
