import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getResendClient } from "@/lib/resend";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recoveryEmail } = await req.json();

    if (!recoveryEmail || !recoveryEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        recoveryEmail: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create or update recovery email
    if (user.recoveryEmail) {
      await prisma.recoveryEmail.update({
        where: { id: user.recoveryEmail.id },
        data: {
          email: recoveryEmail,
          verified: false,
          token,
          tokenExpiry,
        },
      });
    } else {
      await prisma.recoveryEmail.create({
        data: {
          userId: user.id,
          email: recoveryEmail,
          verified: false,
          token,
          tokenExpiry,
        },
      });
    }

    // Send verification email
    const verificationUrl = `${req.nextUrl.origin}/verify-recovery-email?token=${token}`;
    
    try {
      const resend = getResendClient();
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@adhub.com",
        to: recoveryEmail,
        subject: "Verify Your Recovery Email",
        html: `
          <h2>Verify Your Recovery Email</h2>
          <p>Please click the link below to verify your recovery email address:</p>
          <p><a href="${verificationUrl}">Verify Recovery Email</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this verification, you can safely ignore this email.</p>
        `,
      });
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (err: any) {
    console.error("Error sending recovery email:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error sending recovery email" },
      { status: 500 }
    );
  }
}
