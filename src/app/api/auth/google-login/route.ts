import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!existingUser) {
      return NextResponse.json(
        {
          exists: false,
          message: "No account found with this email. Please sign up first.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ exists: true }, { status: 200 });
  } catch (error) {
    console.error("Google login check error:", error);
    return NextResponse.json({ error: "Failed to check account status" }, { status: 500 });
  }
}
