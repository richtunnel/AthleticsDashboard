export function validateStripeEnv() {
  const requiredVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_MONTHLY_PRICE_ID",
    "STRIPE_ANNUAL_PRICE_ID",
    "NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID",
    "NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID",
  ];

  const missing: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing Stripe environment variables: ${missing.join(', ')}\n` +
      `Subscription features may not work correctly.`
    );
  }

  return missing.length === 0;
}

export function getStripePriceId(planType: 'MONTHLY' | 'ANNUAL'): string | undefined {
  return planType === 'MONTHLY'
    ? process.env.STRIPE_MONTHLY_PRICE_ID
    : process.env.STRIPE_ANNUAL_PRICE_ID;
}
