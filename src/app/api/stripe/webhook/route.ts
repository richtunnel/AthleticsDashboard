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
    const sub = event.data.object as Stripe.Subscription;
    await prisma.user.update({
      where: { subscriptionId: sub.id || "No subscription ID" },
      data: {
        plan: sub.status === "active" || sub.status === "trialing" ? sub.items.data[0].price.id : "free",
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      },
    });
  }

  return NextResponse.json({ received: true });
}
