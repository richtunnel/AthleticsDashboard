import { validateStripeConfig as validateConfig, getStripeConfig, isStripeTestMode } from '../stripe-config';

/**
 * @deprecated Use validateStripeConfig from stripe-config instead
 */
export function validateStripeEnv() {
  const result = validateConfig();
  return result.valid;
}

/**
 * Re-export for convenience
 */
export { validateConfig as validateStripeConfig, getStripeConfig, isStripeTestMode };
