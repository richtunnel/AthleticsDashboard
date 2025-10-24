import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSessionSchema } from "@/lib/validations/subscription";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = createCheckoutSessionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { planType } = validationResult.data;

    const priceId =
      planType === "MONTHLY"
        ? process.env.STRIPE_MONTHLY_PRICE_ID
        : process.env.STRIPE_ANNUAL_PRICE_ID;

    if (!priceId) {
      console.error(`Missing price ID for plan type: ${planType}`);
      return NextResponse.json(
        { error: "Subscription plan configuration error. Please contact support." },
        { status: 500 }
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
    }

    const now = new Date();
    const trialEligible = !user.hasReceivedFreeTrial;

    const subscriptionData = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stripeCustomerId: customerId,
        planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd: trialEligible ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
      },
      update: {
        stripeCustomerId: customerId,
        planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd: trialEligible ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
      },
    });

    const checkoutSessionParams: any = {
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.nextUrl.origin}/onboarding/details?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/onboarding/plans?canceled=true`,
      metadata: {
        userId: user.id,
        planType,
        subscriptionRecordId: subscriptionData.id,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planType,
        },
      },
    };

    if (trialEligible) {
      checkoutSessionParams.subscription_data.trial_period_days = 14;
    }

    const idempotencyKey = `checkout_${user.id}_${planType}_${Date.now()}`;

    const checkoutSession = await stripe.checkout.sessions.create(
      checkoutSessionParams,
      {
        idempotencyKey,
      }
    );

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      trialEligible,
    });
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
