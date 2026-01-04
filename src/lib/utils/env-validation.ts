import { validateStripeConfig as validateConfig, getStripeConfig, isStripeTestMode } from '../stripe-config';

/**
 * @deprecated Use validateStripeConfig from stripe-config instead
 */
export function validateStripeEnv() {
  const result = validateConfig();
  return result.valid;
}

/**
 * Gets the price ID for a given plan type and tier
 */
export function getStripePriceId(tier: 'standard' | 'team' | 'plus', cycle: 'monthly' | 'annual'): string | undefined {
  const config = getStripeConfig();
  
  switch (tier) {
    case 'standard':
      return cycle === 'monthly' ? config.standardPriceIdMo : config.standardPriceIdYr;
    case 'team':
      return cycle === 'monthly' ? config.teamPriceIdMo : config.teamPriceIdYr;
    case 'plus':
      return cycle === 'monthly' ? config.plusPriceIdMo : config.plusPriceIdYr;
    default:
      return undefined;
  }
}

/**
 * Re-export for convenience
 */
export { validateConfig as validateStripeConfig, getStripeConfig, isStripeTestMode };
