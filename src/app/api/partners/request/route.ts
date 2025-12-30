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

    // Check if email already submitted a partner request
    const existingRequest = await prisma.partnerRequest.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        return NextResponse.json(
          { message: "You have already submitted a partnership request. Our team will contact you shortly." },
          { status: 200 }
        );
      } else if (existingRequest.status === "CONTACTED" || existingRequest.status === "APPROVED") {
        return NextResponse.json(
          { message: "You have already been contacted about partnership. Please check your email." },
          { status: 200 }
        );
      }
    }

    // Create new partner request
    await prisma.partnerRequest.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        schoolOrCollege: schoolOrCollege.trim(),
        status: "PENDING",
      },
    });

    return NextResponse.json(
      { message: "Thank you for your interest! Our team will contact you shortly." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Partner request error:", error);
    return NextResponse.json(
      { error: "Failed to submit partnership request. Please try again later." },
      { status: 500 }
    );
  }
}
