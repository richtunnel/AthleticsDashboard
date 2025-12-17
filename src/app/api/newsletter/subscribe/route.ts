import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email format
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingSubscriber) {
      return NextResponse.json(
        { message: "You're already subscribed to our newsletter!" },
        { status: 200 }
      );
    }

    // Create new subscriber
    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
      },
    });

    return NextResponse.json(
      { message: "Successfully subscribed to our newsletter!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json(
      { error: "Subscription unsuccessful. Please try again later." },
      { status: 500 }
    );
  }
}
