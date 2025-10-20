import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

type StartSearchParams = { plan?: string };
export default async function StartPage({ searchParams }: { searchParams: Promise<StartSearchParams> }) {
  const { plan } = await searchParams;
  const stripe = getStripe();

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/onboarding/plans");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email! },
  });

  if (!user) {
    // If somehow no user record, send them back to plans
    redirect("/onboarding/plans");
  }

  // If user already has a plan, continue onboarding
  if (user.plan) {
    redirect("/onboarding/details");
  }

  // Ensure Stripe customer
  let customerId = user.stripeCustomerId || undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || "",
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Default trial period
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Require a plan in querystring
  if (!plan) {
    redirect("/onboarding/plans");
  }

  if (plan === "free") {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "free", trialEnd },
    });
    redirect("/onboarding/details");
  }

  // Map paid plans to price IDs
  let priceId: string | undefined;
  switch (plan) {
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

  if (!priceId) {
    // Missing price configuration → fail safe
    redirect("/onboarding/plans");
  }

  // Create subscription in trial (incomplete until payment)
  const subscription = await stripe.subscriptions.create({
    customer: customerId!,
    items: [{ price: priceId }],
    trial_period_days: 14,
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan,
      subscriptionId: subscription.id,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : trialEnd,
    },
  });

  redirect("/onboarding/details");
}
