import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/database/prisma";
import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const buf = Buffer.from(body);
  const sig = req.headers.get("stripe-signature")!;
  const stripe = getStripe();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const stripeSub = event.data.object as Stripe.Subscription;
    
    // Find user by stripe customer ID
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: stripeSub.customer as string },
      include: { subscription: true },
    });

    if (!user) {
      console.error("User not found for Stripe customer:", stripeSub.customer);
      return NextResponse.json({ received: true });
    }

    // Update legacy fields for backward compatibility
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: stripeSub.status === "active" || stripeSub.status === "trialing" ? stripeSub.items.data[0].price.id : "free",
        trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
        subscriptionId: stripeSub.id,
      },
    });

    // Determine status based on Stripe subscription status
    type SubscriptionStatusType = "ACTIVE" | "TRIALING" | "CANCELED" | "PAST_DUE" | "UNPAID" | "INCOMPLETE" | "GRACE_PERIOD";
    let status: SubscriptionStatusType = "ACTIVE";
    switch (stripeSub.status) {
      case "active":
        status = "ACTIVE";
        break;
      case "trialing":
        status = "TRIALING";
        break;
      case "canceled":
        status = "CANCELED";
        break;
      case "past_due":
        status = "PAST_DUE";
        break;
      case "unpaid":
        status = "UNPAID";
        break;
      case "incomplete":
        status = "INCOMPLETE";
        break;
    }

    // Determine plan type
    const priceId = stripeSub.items.data[0].price.id;
    type PlanTypeType = "FREE" | "STANDARD_MONTHLY" | "STANDARD_YEARLY" | "BUSINESS_MONTHLY" | "BUSINESS_YEARLY";
    type BillingCycleType = "MONTHLY" | "YEARLY" | null;
    let planType: PlanTypeType = "FREE";
    let billingCycle: BillingCycleType = null;

    if (priceId) {
      if (priceId.includes("monthly")) {
        billingCycle = "MONTHLY";
        planType = priceId.includes("business") ? "BUSINESS_MONTHLY" : "STANDARD_MONTHLY";
      } else if (priceId.includes("yearly") || priceId.includes("annual")) {
        billingCycle = "YEARLY";
        planType = priceId.includes("business") ? "BUSINESS_YEARLY" : "STANDARD_YEARLY";
      }
    }

    // Update or create subscription record
    const stripeSubAny = stripeSub as any;
    if (user.subscription) {
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          stripeSubscriptionId: stripeSub.id,
          stripePriceId: priceId,
          status,
          planType,
          billingCycle,
          currentPeriodStart: new Date((stripeSubAny.current_period_start as number) * 1000),
          currentPeriodEnd: new Date((stripeSubAny.current_period_end as number) * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeSubscriptionId: stripeSub.id,
          stripePriceId: priceId,
          status,
          planType,
          billingCycle,
          currentPeriodStart: new Date((stripeSubAny.current_period_start as number) * 1000),
          currentPeriodEnd: new Date((stripeSubAny.current_period_end as number) * 1000),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
