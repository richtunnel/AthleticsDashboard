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
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType;

        if (!userId) {
          console.error("No userId in checkout session metadata");
          break;
        }

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

          const statusMap: Record<string, any> = {
            incomplete: "INCOMPLETE",
            incomplete_expired: "INCOMPLETE_EXPIRED",
            trialing: "TRIALING",
            active: "ACTIVE",
            past_due: "PAST_DUE",
            canceled: "CANCELED",
            unpaid: "UNPAID",
          };

          const subscriptionStatus = statusMap[stripeSubscription.status] || "INCOMPLETE";

          const subData = stripeSubscription as any;

          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: subscriptionId,
              status: subscriptionStatus,
              currentPeriodStart: subData.current_period_start
                ? new Date(subData.current_period_start * 1000)
                : null,
              currentPeriodEnd: subData.current_period_end
                ? new Date(subData.current_period_end * 1000)
                : null,
              trialStart: subData.trial_start
                ? new Date(subData.trial_start * 1000)
                : null,
              trialEnd: subData.trial_end
                ? new Date(subData.trial_end * 1000)
                : null,
            },
          });

          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionId: subscriptionId,
              plan: planType
                ? planType === "MONTHLY"
                  ? "standard_monthly"
                  : "standard_yearly"
                : undefined,
              trialEnd: subData.trial_end
                ? new Date(subData.trial_end * 1000)
                : null,
              hasReceivedFreeTrial: subData.trial_end ? true : undefined,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const subData = sub as any;

        const statusMap: Record<string, any> = {
          incomplete: "INCOMPLETE",
          incomplete_expired: "INCOMPLETE_EXPIRED",
          trialing: "TRIALING",
          active: "ACTIVE",
          past_due: "PAST_DUE",
          canceled: "CANCELED",
          unpaid: "UNPAID",
        };

        const subscriptionStatus = statusMap[sub.status] || "INCOMPLETE";

        if (userId) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              stripeSubscriptionId: sub.id,
              status: subscriptionStatus,
              currentPeriodStart: subData.current_period_start
                ? new Date(subData.current_period_start * 1000)
                : null,
              currentPeriodEnd: subData.current_period_end
                ? new Date(subData.current_period_end * 1000)
                : null,
              cancelAt: subData.cancel_at ? new Date(subData.cancel_at * 1000) : null,
              canceledAt: subData.canceled_at ? new Date(subData.canceled_at * 1000) : null,
              trialStart: subData.trial_start ? new Date(subData.trial_start * 1000) : null,
              trialEnd: subData.trial_end ? new Date(subData.trial_end * 1000) : null,
            },
          });

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan:
                sub.status === "active" || sub.status === "trialing"
                  ? sub.items.data[0]?.price.id
                  : "free",
              trialEnd: subData.trial_end ? new Date(subData.trial_end * 1000) : null,
            },
          });
        } else {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: subscriptionStatus,
              currentPeriodStart: subData.current_period_start
                ? new Date(subData.current_period_start * 1000)
                : null,
              currentPeriodEnd: subData.current_period_end
                ? new Date(subData.current_period_end * 1000)
                : null,
              cancelAt: subData.cancel_at ? new Date(subData.cancel_at * 1000) : null,
              canceledAt: subData.canceled_at ? new Date(subData.canceled_at * 1000) : null,
              trialStart: subData.trial_start ? new Date(subData.trial_start * 1000) : null,
              trialEnd: subData.trial_end ? new Date(subData.trial_end * 1000) : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;

        if (userId) {
          await prisma.subscription.update({
            where: { userId },
            data: {
              status: "CANCELED",
              canceledAt: new Date(),
            },
          });

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: "free",
            },
          });
        } else {
          await prisma.subscription.update({
            where: { stripeSubscriptionId: sub.id },
            data: {
              status: "CANCELED",
              canceledAt: new Date(),
            },
          });
        }
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`Trial will end for subscription: ${sub.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
