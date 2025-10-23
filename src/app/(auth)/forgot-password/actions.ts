"use server";

import { prisma } from "@/lib/database/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 3;

interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return {
        success: false,
        message: "Please enter a valid email address",
      };
    }

    // Rate limiting check
    const now = Date.now();
    const rateLimit = rateLimitStore.get(normalizedEmail);
    
    if (rateLimit) {
      if (now - rateLimit.timestamp < RATE_LIMIT_WINDOW) {
        if (rateLimit.count >= RATE_LIMIT_MAX_ATTEMPTS) {
          return {
            success: false,
            message: "Too many reset attempts. Please try again later.",
          };
        }
        rateLimit.count++;
      } else {
        rateLimitStore.set(normalizedEmail, { count: 1, timestamp: now });
      }
    } else {
      rateLimitStore.set(normalizedEmail, { count: 1, timestamp: now });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // For security, always return success message even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      return {
        success: true,
        message: "If an account exists with this email, you will receive a password reset link shortly.",
      };
    }

    // Don't allow password reset for Google OAuth users without passwords
    if (!user.hashedPassword) {
      return {
        success: true,
        message: "If an account exists with this email, you will receive a password reset link shortly.",
      };
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 12);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store hashed token in database
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    if (resend) {
      const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "AD Hub <noreply@yourdomain.com>",
          to: normalizedEmail,
          subject: "Reset Your Password - AD Hub",
          html: buildPasswordResetEmail(user.name || "there", resetUrl),
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Clear the reset token if email fails
        await prisma.user.update({
          where: { email: normalizedEmail },
          data: {
            resetToken: null,
            resetTokenExpiry: null,
          },
        });
        return {
          success: false,
          message: "Failed to send reset email. Please try again later.",
        };
      }
    } else {
      console.error("Email service not configured");
      return {
        success: false,
        message: "Email service is not configured. Please contact support.",
      };
    }

    return {
      success: true,
      message: "If an account exists with this email, you will receive a password reset link shortly.",
    };
  } catch (error) {
    console.error("Password reset request error:", error);
    return {
      success: false,
      message: "An error occurred. Please try again later.",
    };
  }
}

function buildPasswordResetEmail(userName: string, resetUrl: string): string {
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Reset Your Password</h1>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password for your AD Hub account.</p>
          <div class="button-container">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2563eb; font-size: 14px;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
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
