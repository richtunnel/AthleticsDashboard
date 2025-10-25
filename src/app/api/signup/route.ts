import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, plan } = body;

    console.log("[Signup] Signup attempt for email:", email?.toLowerCase());

    // Validation
    if (!email || !password || !name) {
      console.error("[Signup] Missing required fields:", { email: !!email, password: !!password, name: !!name });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 8) {
      console.error("[Signup] Password too short for email:", email?.toLowerCase());
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.error("[Signup] User already exists:", normalizedEmail);
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
          email: normalizedEmail,
          name,
          metadata: {
            plan: plan,
            source: "onboarding",
          },
        });
        stripeCustomerId = customer.id;
        console.log("[Signup] Stripe customer created:", customer.id, "for email:", normalizedEmail);
      } catch (stripeError) {
        console.error("[Signup] Stripe customer creation error for email:", normalizedEmail, stripeError);
        // Continue with user creation even if Stripe fails - we can retry later
      }
    }

    // Create user with organization and plan
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
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

    console.log("[Signup] User created successfully:", user.id, normalizedEmail);

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
    console.error("[Signup] Unexpected error during signup:", error);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
