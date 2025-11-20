import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { isSignupBlocked, getDaysRemaining } from "@/lib/services/signup-log.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();

    // Check if email is blocked due to recent account deletion (90-day rule)
    const signupCheck = await isSignupBlocked(normalizedEmail);
    if (signupCheck.blocked) {
      const daysRemaining = signupCheck.expiresAt ? getDaysRemaining(signupCheck.expiresAt) : 90;
      return NextResponse.json(
        {
          exists: true,
          blocked: true,
          message: `This email was used for an account that was recently deleted. Please wait ${daysRemaining} more days before signing up again, or contact support if you believe this is an error.`,
          daysRemaining,
        },
        { status: 403 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          exists: true,
          message: "An account with this email already exists. Please login instead.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ exists: false }, { status: 200 });
  } catch (error) {
    console.error("Google signup check error:", error);
    return NextResponse.json({ error: "Failed to check account status" }, { status: 500 });
  }
}
