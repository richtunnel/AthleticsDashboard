import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy Stripe singleton (defined in this file to avoid import-time instantiation)
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(key, { apiVersion: "2025-09-30.clover" });
  }
  return stripeClient;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();

    let customerId = user.stripeCustomerId || undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const returnUrl = `${req.nextUrl.origin}/dashboard/settings`;

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId!,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error creating portal session" }, { status: 500 });
  }
}
