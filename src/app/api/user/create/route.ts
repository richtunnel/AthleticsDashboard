import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { emailService } from "@/lib/services/email.service";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with their own organization
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        hashedPassword,
        role: "ATHLETIC_DIRECTOR",
        organization: {
          create: {
            name: `${name}'s Organization`,
            timezone: "America/New_York",
          },
        },
      },
    });

    // Send welcome email (non-blocking)
    try {
      await emailService.sendWelcomeEmail({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (welcomeEmailError) {
      console.error("Failed to send welcome email:", welcomeEmailError);
      // Don't fail the user creation if welcome email fails
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
