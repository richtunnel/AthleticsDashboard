"use server";

import { prisma } from "@/lib/database/prisma";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface ValidateTokenResult {
  valid: boolean;
  message?: string;
}

interface ResetPasswordResult {
  success: boolean;
  message: string;
}

export async function validateResetToken(token: string, email: string): Promise<ValidateTokenResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        resetToken: true,
        resetTokenExpiry: true,
      },
    });

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      return {
        valid: false,
        message: "Invalid or expired reset token",
      };
    }

    // Check if token is expired
    if (new Date() > user.resetTokenExpiry) {
      // Clear expired token
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return {
        valid: false,
        message: "This reset link has expired. Please request a new one.",
      };
    }

    // Verify token matches
    const isValidToken = await bcrypt.compare(token, user.resetToken);

    if (!isValidToken) {
      return {
        valid: false,
        message: "Invalid reset token",
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("Token validation error:", error);
    return {
      valid: false,
      message: "An error occurred while validating the token",
    };
  }
}

export async function resetPassword(
  token: string,
  email: string,
  newPassword: string,
  confirmPassword: string
): Promise<ResetPasswordResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      return {
        success: false,
        message: "Passwords do not match",
      };
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long",
      };
    }

    // Check for at least one number and one letter (basic complexity)
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasLetter || !hasNumber) {
      return {
        success: false,
        message: "Password must contain at least one letter and one number",
      };
    }

    // Validate token first
    const tokenValidation = await validateResetToken(token, normalizedEmail);
    if (!tokenValidation.valid) {
      return {
        success: false,
        message: tokenValidation.message || "Invalid token",
      };
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        hashedPassword: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Send confirmation email
    if (resend) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "AD Hub <noreply@yourdomain.com>",
          to: normalizedEmail,
          subject: "Password Successfully Reset - AD Hub",
          html: buildPasswordResetConfirmationEmail(user.name || "there"),
        });
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        // Don't fail the reset if email fails - password is already updated
      }
    }

    return {
      success: true,
      message: "Your password has been successfully reset. You can now log in with your new password.",
    };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      message: "An error occurred while resetting your password. Please try again.",
    };
  }
}

function buildPasswordResetConfirmationEmail(userName: string): string {
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
          <div class="success-icon">✓</div>
          <h1>Password Successfully Reset</h1>
          <p>Hi ${userName},</p>
          <p>Your password has been successfully reset. You can now use your new password to sign in to your AD Hub account.</p>
          <div class="button-container">
            <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login" class="button">Sign In</a>
          </div>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you did not make this change, please contact support immediately as your account may be compromised.
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
