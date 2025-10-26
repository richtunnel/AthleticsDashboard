import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSessionByPriceSchema } from "@/lib/validations/subscription";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const priceIdToPlanTypeMap: Record<string, "MONTHLY" | "ANNUAL"> = (() => {
  const mapping: Record<string, "MONTHLY" | "ANNUAL"> = {};
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID;
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID;

  if (monthly) {
    mapping[monthly] = "MONTHLY";
  }

  if (annual) {
    mapping[annual] = "ANNUAL";
  }

  return mapping;
})();

const TRIAL_PERIOD_DAYS = 14;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Failed to parse checkout session payload", error);
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const validationResult = createCheckoutSessionByPriceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { priceId } = validationResult.data;
    const planType = priceIdToPlanTypeMap[priceId];

    if (!planType) {
      console.error("Attempted to create checkout session with unknown price ID", priceId);
      return NextResponse.json(
        {
          error: "Unsupported price. Please contact support.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        hasReceivedFreeTrial: true,
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;

        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        });
      } catch (error) {
        console.error("Failed to create Stripe customer", error);
        return NextResponse.json(
          {
            error: "Unable to create billing profile. Please try again or contact support.",
          },
          { status: 500 }
        );
      }
    }

    const now = new Date();
    const trialEligible = !user.hasReceivedFreeTrial;
    const trialEnd = trialEligible ? new Date(now.getTime() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000) : null;

    const subscriptionRecord = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        customerId,
        stripeCustomerId: customerId,
        planType,
        billingCycle: planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd,
      },
      update: {
        customerId,
        stripeCustomerId: customerId,
        planType,
        billingCycle: planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd,
      },
    });

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
    const successUrl = `${baseUrl}/dashboard/settings?checkout=success`;
    const cancelUrl = `${baseUrl}/onboarding/plans?checkout=cancelled`;

    const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planType,
        subscriptionRecordId: subscriptionRecord.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planType,
        },
      },
    };

    if (customerId) {
      checkoutSessionParams.customer = customerId;
    } else if (user.email) {
      checkoutSessionParams.customer_email = user.email;
    }

    if (trialEligible) {
      checkoutSessionParams.subscription_data = {
        ...checkoutSessionParams.subscription_data,
        trial_period_days: TRIAL_PERIOD_DAYS,
      };
    }

    const idempotencyKey = `checkout_${user.id}_${priceId}_${Date.now()}`;

    const checkoutSession = await stripe.checkout.sessions.create(checkoutSessionParams, {
      idempotencyKey,
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      trialEligible,
    });
  } catch (error: any) {
    console.error("create-checkout-session.error", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
