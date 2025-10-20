import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Do NOT construct Stripe without a key; only throw when actually used
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeSingleton = new Stripe(key, { apiVersion: "2025-09-30.clover" });
  }
  return stripeSingleton;
}
