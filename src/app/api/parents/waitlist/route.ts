import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, schoolOrCollege } = body;

    // Validate required fields
    if (!fullName || !email || !schoolOrCollege) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already on waitlist
    const existingEntry = await prisma.waitlistEntry.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEntry) {
      if (existingEntry.status === "PENDING") {
        return NextResponse.json(
          { message: "You're already on the waitlist! We'll notify you when the Parent Portal is available." },
          { status: 200 }
        );
      } else if (existingEntry.status === "NOTIFIED" || existingEntry.status === "CONVERTED") {
        return NextResponse.json(
          { message: "You've already been notified about the Parent Portal launch. Check your email!" },
          { status: 200 }
        );
      }
    }

    // Create new waitlist entry
    await prisma.waitlistEntry.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        schoolOrCollege: schoolOrCollege.trim(),
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { message: "You've been added to the waitlist! We'll notify you when the Parent Portal is available." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Waitlist submission error:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist. Please try again later." },
      { status: 500 }
    );
  }
}
