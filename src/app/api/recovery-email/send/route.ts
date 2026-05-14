import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { normalizeBrowserUrl } from "@/lib/utils/url";
import { getSiteUrl } from "@/lib/utils/siteUrl";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();
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

    // Send verification email — use env-driven site URL since this URL is embedded
    // in an email and must point to the public domain, not the server's bind address.
    const baseUrl = normalizeBrowserUrl(process.env.NEXT_PUBLIC_APP_URL || getSiteUrl());
    const verificationUrl = `${baseUrl}/verify-recovery-email?token=${token}`;

    try {
      await emailService.sendEmail({
        to: [recoveryEmail],
        subject: "Verify Your Recovery Email",
        body: `
          <h2>Verify Your Recovery Email</h2>
          <p>Please click the link below to verify your recovery email address:</p>
          <p><a href="${verificationUrl}">Verify Recovery Email</a></p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't request this verification, you can safely ignore this email.</p>
        `,
        sentById: session.user.id,
        immediate: true,
      });
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (err: any) {
    console.error("Error sending recovery email:", err);
    return NextResponse.json({ error: err?.message ?? "Unexpected error sending recovery email" }, { status: 500 });
  }
}
