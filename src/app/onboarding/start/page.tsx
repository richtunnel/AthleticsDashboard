import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

export default async function StartPage({ searchParams }: { searchParams: { plan: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/onboarding/plans");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.plan) redirect("/onboarding/details");

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, name: user.name || "" });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  if (searchParams.plan === "free") {
    await prisma.user.update({ where: { id: user.id }, data: { plan: "free", trialEnd } });
  } else {
    let priceId: string | undefined;
    switch (searchParams.plan) {
      case "standard_monthly":
        priceId = process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID;
        break;
      case "standard_yearly":
        priceId = process.env.STRIPE_STANDARD_YEARLY_PRICE_ID;
        break;
      case "business_yearly":
        priceId = process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID;
        break;
      default:
        redirect("/onboarding/plans");
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: searchParams.plan,
        subscriptionId: subscription.id,
        trialEnd: new Date(subscription.trial_end! * 1000),
      },
    });
  }

  redirect("/onboarding/details");
}
