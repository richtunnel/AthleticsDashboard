import { getServerSession } from "next-auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/utils/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.redirect("/onboarding/plans");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: "No customer" }, { status: 400 });

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/`, // e.g., http://localhost:3000
  });

  return NextResponse.redirect(portalSession.url);
}
