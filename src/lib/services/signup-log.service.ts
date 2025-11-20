/**
 * Signup Log Service
 * 
 * Prevents duplicate signups within 90 days by tracking email/phone numbers
 * from deleted accounts.
 */

import { prisma } from "@/lib/database/prisma";

const SIGNUP_BLOCK_DAYS = 90;

/**
 * Check if an email or phone is blocked from signing up
 */
export async function isSignupBlocked(email?: string | null, phone?: string | null): Promise<{
  blocked: boolean;
  reason?: string;
  expiresAt?: Date;
}> {
  if (!email && !phone) {
    return { blocked: false };
  }

  const now = new Date();
  
  // Check if email or phone exists in SignupLog and hasn't expired
  const existingLog = await prisma.signupLog.findFirst({
    where: {
      AND: [
        {
          OR: [
            email ? { email: email.toLowerCase() } : {},
            phone ? { phone } : {},
          ].filter(obj => Object.keys(obj).length > 0),
        },
        {
          expiresAt: {
            gt: now,
          },
        },
      ],
    },
    orderBy: {
      expiresAt: 'desc',
    },
  });

  if (existingLog) {
    return {
      blocked: true,
      reason: existingLog.reason || 'Account with this email/phone was recently deleted. Please try again later.',
      expiresAt: existingLog.expiresAt,
    };
  }

  return { blocked: false };
}

/**
 * Create a signup log entry when a user deletes their account
 */
export async function createSignupLog(params: {
  email?: string | null;
  phone?: string | null;
  deletedUserId: string;
  reason?: string;
}): Promise<void> {
  const { email, phone, deletedUserId, reason } = params;

  if (!email && !phone) {
    console.warn('[SignupLog] No email or phone provided for signup log');
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SIGNUP_BLOCK_DAYS * 24 * 60 * 60 * 1000);

  await prisma.signupLog.create({
    data: {
      email: email ? email.toLowerCase() : null,
      phone: phone || null,
      deletedUserId,
      deletedAt: now,
      expiresAt,
      reason: reason || 'account_deleted',
    },
  });

  console.log('[SignupLog] Created signup log for user:', deletedUserId, 'expires:', expiresAt);
}

/**
 * Clean up expired signup logs (can be run periodically)
 */
export async function cleanupExpiredSignupLogs(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.signupLog.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });

  console.log('[SignupLog] Cleaned up', result.count, 'expired signup logs');
  return result.count;
}

/**
 * Get days remaining until signup is allowed
 */
export function getDaysRemaining(expiresAt: Date): number {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
