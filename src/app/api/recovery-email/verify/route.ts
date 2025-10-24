import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const recoveryEmail = await prisma.recoveryEmail.findUnique({
      where: { token },
    });

    if (!recoveryEmail) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
    }

    // Check if token has expired
    if (recoveryEmail.tokenExpiry && recoveryEmail.tokenExpiry < new Date()) {
      return NextResponse.json({ error: "Token has expired" }, { status: 400 });
    }

    // Mark as verified
    await prisma.recoveryEmail.update({
      where: { id: recoveryEmail.id },
      data: {
        verified: true,
        token: null,
        tokenExpiry: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Recovery email verified successfully",
    });
  } catch (err: any) {
    console.error("Error verifying recovery email:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error verifying recovery email" },
      { status: 500 }
    );
  }
}
