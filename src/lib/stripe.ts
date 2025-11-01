import Stripe from "stripe";
import { isStripeTestMode, logTestModeInfo } from "./stripe-config";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Do NOT construct Stripe without a key; only throw when actually used
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    
    const testMode = isStripeTestMode(key);
    
    stripeSingleton = new Stripe(key, { 
      apiVersion: "2025-10-29.clover",
      typescript: true,
      appInfo: {
        name: "AD Hub",
        version: "1.0.0",
      },
    });
    
    // Log when initializing in test mode
    if (testMode) {
      logTestModeInfo("Stripe client initialized", {
        mode: "test",
        apiVersion: "2025-10-29.clover",
      });
    }
  }
  return stripeSingleton;
}

/**
 * Reset the Stripe singleton (useful for testing)
 */
export function resetStripe(): void {
  stripeSingleton = null;
}
