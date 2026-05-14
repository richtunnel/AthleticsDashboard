import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { normalizeBrowserUrl } from "@/lib/utils/url";
import { getSiteUrl } from "@/lib/utils/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for billing management
 * 
 * Features:
 * - View and download invoices
 * - Update payment methods
 * - View subscription details
 * - Cancel/resume subscriptions
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Please subscribe to a plan first." },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Build return URL — env-driven so the Stripe portal never bounces users back to 0.0.0.0:3000.
    const rawBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || getSiteUrl()).replace(/\/$/, "");
    const baseUrl = normalizeBrowserUrl(rawBaseUrl);
    const returnUrl = `${baseUrl}/dashboard/settings`;

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error("stripe.portal.error", error);
    return NextResponse.json(
      {
        error: "Failed to create billing portal session",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
