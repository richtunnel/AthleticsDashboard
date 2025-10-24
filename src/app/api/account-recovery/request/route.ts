import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_ATTEMPTS = 2;
const TOKEN_EXPIRY_HOURS = 24;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        accountRecoveries: {
          where: {
            used: false,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const now = Date.now();
    const rateLimit = rateLimitStore.get(userId);

    if (rateLimit) {
      if (now - rateLimit.timestamp < RATE_LIMIT_WINDOW) {
        if (rateLimit.count >= RATE_LIMIT_MAX_ATTEMPTS) {
          return NextResponse.json(
            {
              success: false,
              message: "Too many recovery requests. Please try again later.",
            },
            { status: 429 }
          );
        }
        rateLimit.count++;
      } else {
        rateLimitStore.set(userId, { count: 1, timestamp: now });
      }
    } else {
      rateLimitStore.set(userId, { count: 1, timestamp: now });
    }

    await prisma.accountRecovery.updateMany({
      where: {
        userId: userId,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    const recoveryToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(recoveryToken, 12);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const accountRecovery = await prisma.accountRecovery.create({
      data: {
        userId: userId,
        email: user.email,
        hashedToken,
        expiresAt,
      },
    });

    if (!resend) {
      return NextResponse.json(
        {
          success: false,
          message: "Email service is not configured. Please contact support.",
        },
        { status: 500 }
      );
    }

    const recoveryUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/account-recovery?token=${recoveryToken}&email=${encodeURIComponent(user.email)}`;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "AD Hub <noreply@yourdomain.com>",
        to: user.email,
        subject: "Account Recovery Link - AD Hub",
        html: buildAccountRecoveryEmail(user.name || "there", recoveryUrl, TOKEN_EXPIRY_HOURS),
      });
    } catch (emailError) {
      console.error("Failed to send account recovery email:", emailError);

      await prisma.accountRecovery.delete({
        where: { id: accountRecovery.id },
      });

      return NextResponse.json(
        {
          success: false,
          message: "Failed to send recovery email. Please try again later.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recovery email sent successfully. Please check your email.",
      lastSent: accountRecovery.createdAt,
      expiresAt: accountRecovery.expiresAt,
    });
  } catch (error) {
    console.error("Account recovery request error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}

function buildAccountRecoveryEmail(userName: string, recoveryUrl: string, expiryHours: number): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #2563eb;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
          }
          p {
            margin: 15px 0;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
            text-align: center;
          }
          .button-container {
            text-align: center;
          }
          .info-box {
            background-color: #dbeafe;
            border-left: 4px solid #2563eb;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
            text-align: center;
          }
          ul {
            margin: 10px 0;
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Account Recovery</h1>
          <p>Hi ${userName},</p>
          <p>You've requested an account recovery link for your AD Hub account. This link can be used to:</p>
          <ul>
            <li>Recover access to your account if scheduled for deletion</li>
            <li>Reactivate your subscription</li>
            <li>Restore your account settings</li>
          </ul>
          <div class="button-container">
            <a href="${recoveryUrl}" class="button">Recover My Account</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${recoveryUrl}</p>
          <div class="info-box">
            <strong>ℹ️ What happens next?</strong><br>
            Clicking this link will immediately restore your account access and clear any scheduled deletion. Your subscription status will be reviewed and updated if necessary.
          </div>
          <div class="warning">
            <strong>⚠️ Important:</strong> This link will expire in ${expiryHours} hours for security reasons. Each recovery link can only be used once. If you didn't request this recovery, please ignore this email or contact support if you have concerns about your account security.
          </div>
          <div class="footer">
            <p>This email was sent from AD Hub by Sports Source.</p>
            <p>If you need help, please contact support.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
