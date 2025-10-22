import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, plan } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let stripeCustomerId = null;
    
    // Create Stripe customer if plan is selected (not free trial)
    if (plan && plan !== "free_trial_plan") {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name,
          metadata: {
            plan: plan,
            source: 'onboarding'
          }
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.error("Stripe customer creation error:", stripeError);
        // Continue with user creation even if Stripe fails - we can retry later
      }
    }

    // Create user with organization and plan
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        hashedPassword,
        role: "ATHLETIC_DIRECTOR",
        plan: plan || "free_trial_plan",
        stripeCustomerId,
        trialEnd: plan === "free_trial_plan" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null, // 14 days from now
        organization: {
          create: {
            name: `${name}'s Organization`,
            timezone: "America/New_York",
          },
        },
      },
      include: {
        organization: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          organizationId: user.organizationId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}