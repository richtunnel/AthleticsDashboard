import { NextResponse } from "next/server";

// Resolve a price ID — prefer private (server-only) env var, fall back to NEXT_PUBLIC_
function resolve(privateKey: string, publicKey: string): string {
  return (process.env[privateKey] || process.env[publicKey] || "").trim();
}

export async function GET() {
  const priceIds = {
    standardMonthly: resolve("STRIPE_STANDARD_PRICE_ID_MO", "NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO"),
    standardAnnual:  resolve("STRIPE_STANDARD_PRICE_ID_YR",  "NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR"),
    teamMonthly:     resolve("STRIPE_TEAM_PRICE_ID_MO",       "NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO"),
    teamAnnual:      resolve("STRIPE_TEAM_PRICE_ID_YR",       "NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR"),
    plusMonthly:     resolve("STRIPE_PLUS_PRICE_ID_MO",        "NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO"),
    plusAnnual:      resolve("STRIPE_PLUS_PRICE_ID_YR",        "NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR"),
  };

  return NextResponse.json(priceIds, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
  });
}
