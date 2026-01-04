import { validateStripeConfig as validateConfig, getStripeConfig, isStripeTestMode } from '../stripe-config';

/**
 * @deprecated Use validateStripeConfig from stripe-config instead
 */
export function validateStripeEnv() {
  const result = validateConfig();
  return result.valid;
}

/**
 * Gets the price ID for a given plan type
 * @deprecated Use getStripeConfig() directly to access specific plan price IDs
 */
export function getStripePriceId(planType: 'MONTHLY' | 'ANNUAL'): string | undefined {
  const config = getStripeConfig();
  // Default to STANDARD plan for backward compatibility
  return planType === 'MONTHLY' ? config.standardPriceIdMo : config.standardPriceIdYr;
}

/**
 * Re-export for convenience
 */
export { validateConfig as validateStripeConfig, getStripeConfig, isStripeTestMode };
