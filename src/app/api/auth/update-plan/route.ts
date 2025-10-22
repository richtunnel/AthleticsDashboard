import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan) {
      return NextResponse.json({ error: "Plan is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true, plan: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let stripeCustomerId = user.stripeCustomerId;
    
    // Create Stripe customer if plan is selected (not free trial) and no customer exists
    if (plan && plan !== "free_trial_plan" && !stripeCustomerId) {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          metadata: {
            plan: plan,
            source: 'onboarding_plan_update'
          }
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.error("Stripe customer creation error:", stripeError);
        // Continue with plan update even if Stripe fails - we can retry later
      }
    }

    // Update user plan and Stripe customer ID
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan: plan,
        stripeCustomerId: stripeCustomerId,
        trialEnd: plan === "free_trial_plan" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        stripeCustomerId: true,
        trialEnd: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Plan update error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}