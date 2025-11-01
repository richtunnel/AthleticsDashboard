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
 */
export function getStripePriceId(planType: 'MONTHLY' | 'ANNUAL'): string | undefined {
  const config = getStripeConfig();
  return planType === 'MONTHLY' ? config.monthlyPriceId : config.annualPriceId;
}

/**
 * Re-export for convenience
 */
export { validateConfig as validateStripeConfig, getStripeConfig, isStripeTestMode };
