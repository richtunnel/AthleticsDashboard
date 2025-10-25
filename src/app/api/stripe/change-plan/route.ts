import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { changePlanSchema } from "@/lib/validations/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = changePlanSchema.safeParse(body);

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
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const stripe = getStripe();

    const currentSubscription = await stripe.subscriptions.retrieve(
      user.subscription.stripeSubscriptionId
    );

    if (!currentSubscription.items.data[0]) {
      return NextResponse.json({ error: "Invalid subscription state" }, { status: 400 });
    }

    const updatedSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: currentSubscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
      }
    );

    const currentPeriodStart = (updatedSubscription as any).current_period_start;
    const currentPeriodEnd = (updatedSubscription as any).current_period_end;

    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        planType,
        billingCycle: planType,
        priceId,
        currentPeriodStart: currentPeriodStart
          ? new Date(currentPeriodStart * 1000)
          : null,
        currentPeriodEnd: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Plan changed successfully",
      planType,
    });
  } catch (error: any) {
    console.error("Plan change error:", error);
    return NextResponse.json(
      {
        error: "Failed to change plan",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
