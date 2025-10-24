import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface ConsumeRequestBody {
  token: string;
  email: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ConsumeRequestBody = await req.json();
    const { token, email } = body;

    if (!token || !email) {
      return NextResponse.json(
        {
          success: false,
          message: "Token and email are required",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        deletionScheduledAt: true,
        plan: true,
        accountRecoveries: {
          where: {
            email: normalizedEmail,
            used: false,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid recovery link",
        },
        { status: 404 }
      );
    }

    let validRecovery = null;

    for (const recovery of user.accountRecoveries) {
      if (new Date() > recovery.expiresAt) {
        await prisma.accountRecovery.update({
          where: { id: recovery.id },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });
        continue;
      }

      const isValidToken = await bcrypt.compare(token, recovery.hashedToken);
      if (isValidToken) {
        validRecovery = recovery;
        break;
      }
    }

    if (!validRecovery) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid or expired recovery link",
        },
        { status: 400 }
      );
    }

    if (new Date() > validRecovery.expiresAt) {
      await prisma.accountRecovery.update({
        where: { id: validRecovery.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: "This recovery link has expired. Please request a new one.",
        },
        { status: 400 }
      );
    }

    await prisma.accountRecovery.update({
      where: { id: validRecovery.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    const updateData: any = {};
    let recoveryActions: string[] = [];

    if (user.deletionScheduledAt) {
      updateData.deletionScheduledAt = null;
      recoveryActions.push("Account deletion cancelled");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "AD Hub <noreply@yourdomain.com>",
          to: user.email,
          subject: "Account Successfully Recovered - AD Hub",
          html: buildAccountRecoveryConfirmationEmail(user.name || "there", recoveryActions),
        });
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your account has been successfully recovered. You can now log in.",
      actions: recoveryActions.length > 0 ? recoveryActions : ["Account access restored"],
    });
  } catch (error) {
    console.error("Account recovery consume error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "An error occurred while processing your recovery. Please try again.",
      },
      { status: 500 }
    );
  }
}

function buildAccountRecoveryConfirmationEmail(userName: string, actions: string[]): string {
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
            color: #10b981;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
          }
          p {
            margin: 15px 0;
            font-size: 16px;
          }
          .success-icon {
            text-align: center;
            font-size: 48px;
            margin: 20px 0;
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
            background-color: #d1fae5;
            border-left: 4px solid #10b981;
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
          <div class="success-icon">✓</div>
          <h1>Account Successfully Recovered</h1>
          <p>Hi ${userName},</p>
          <p>Great news! Your AD Hub account has been successfully recovered.</p>
          ${
            actions.length > 0
              ? `
          <div class="info-box">
            <strong>✓ Actions Completed:</strong>
            <ul>
              ${actions.map((action) => `<li>${action}</li>`).join("")}
            </ul>
          </div>
          `
              : ""
          }
          <p>You can now sign in to your account and continue using all the features of AD Hub.</p>
          <div class="button-container">
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login" class="button">Sign In Now</a>
          </div>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you did not request this account recovery, please contact support immediately as your account may be compromised.
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
