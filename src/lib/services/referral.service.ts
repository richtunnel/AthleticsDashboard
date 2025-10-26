import { prisma } from "@/lib/database/prisma";
import { ReferralStatus } from "@prisma/client";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  rewardPointsEarned: number;
  currentPoints: number;
}

const REFERRAL_SIGNUP_POINTS = 100;
const REFERRAL_SUBSCRIPTION_BONUS = 500;

/**
 * Generate referral link for a user
 */
export async function generateReferralLink(userId: string, baseUrl: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user?.email) {
    throw new Error("User not found");
  }

  const encodedEmail = encodeURIComponent(user.email);
  return `${baseUrl}/signup?ref=${encodedEmail}`;
}

/**
 * Track a new referral (called when signup is successful)
 */
export async function trackReferral(referrerEmail: string, newUserId: string, newUserEmail: string): Promise<void> {
  // Find the referrer by email
  const referrer = await prisma.user.findUnique({
    where: { email: referrerEmail },
  });

  if (!referrer) {
    console.warn(`[Referral] Referrer not found with email: ${referrerEmail}`);
    return;
  }

  // Get the new user's information
  const newUser = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { name: true },
  });

  // Check if this referral already exists
  const existingReferral = await prisma.referral.findFirst({
    where: {
      referrerUserId: referrer.id,
      referredUserId: newUserId,
    },
  });

  if (existingReferral) {
    console.warn(`[Referral] Referral already exists for user: ${newUserId}`);
    return;
  }

  // Create referral record
  await prisma.referral.create({
    data: {
      referrerUserId: referrer.id,
      referredEmail: newUserEmail,
      referredUserId: newUserId,
      status: ReferralStatus.SIGNED_UP,
      signedUpAt: new Date(),
    },
  });

  // Award points to referrer
  await awardPoints(referrer.id, REFERRAL_SIGNUP_POINTS);

  console.log(`[Referral] Referral tracked: ${referrerEmail} referred ${newUserEmail}. Awarded ${REFERRAL_SIGNUP_POINTS} points.`);

  // Send notification emails (async, don't block)
  sendReferralSuccessEmail(referrer.email, referrer.name || "there", newUser?.name || "A new user", REFERRAL_SIGNUP_POINTS).catch((err) =>
    console.error("[Referral] Failed to send success email:", err)
  );

  sendWelcomeReferralEmail(newUserEmail, newUser?.name || "there", referrer.name || "a colleague").catch((err) => console.error("[Referral] Failed to send welcome email:", err));
}

/**
 * Award points to a user
 */
export async function awardPoints(userId: string, points: number): Promise<void> {
  // Check if user has a reward points record
  const existingPoints = await prisma.rewardPoints.findUnique({
    where: { userId },
  });

  if (existingPoints) {
    // Update existing points
    await prisma.rewardPoints.update({
      where: { userId },
      data: {
        points: existingPoints.points + points,
      },
    });
  } else {
    // Create new points record
    await prisma.rewardPoints.create({
      data: {
        userId,
        points,
      },
    });
  }

  // Update referral status to REWARDED
  await prisma.referral.updateMany({
    where: {
      referrerUserId: userId,
      status: ReferralStatus.SIGNED_UP,
    },
    data: {
      status: ReferralStatus.REWARDED,
      rewardedAt: new Date(),
      pointsAwarded: points,
    },
  });
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const [referrals, rewardPoints] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerUserId: userId },
    }),
    prisma.rewardPoints.findUnique({
      where: { userId },
    }),
  ]);

  const totalReferrals = referrals.length;
  const pendingReferrals = referrals.filter((r) => r.status === ReferralStatus.PENDING).length;
  const completedReferrals = referrals.filter((r) => r.status === ReferralStatus.SIGNED_UP || r.status === ReferralStatus.REWARDED).length;
  const rewardPointsEarned = referrals.filter((r) => r.status === ReferralStatus.REWARDED).reduce((sum, r) => sum + r.pointsAwarded, 0);

  return {
    totalReferrals,
    pendingReferrals,
    completedReferrals,
    rewardPointsEarned,
    currentPoints: rewardPoints?.points || 0,
  };
}

/**
 * Award bonus points when referred user subscribes
 */
export async function awardSubscriptionBonus(userId: string): Promise<void> {
  // Find the referral for this user
  const referral = await prisma.referral.findFirst({
    where: {
      referredUserId: userId,
      status: ReferralStatus.REWARDED,
    },
    include: {
      referrer: true,
    },
  });

  if (!referral) {
    return;
  }

  // Award bonus points to referrer
  await awardPoints(referral.referrerUserId, REFERRAL_SUBSCRIPTION_BONUS);

  console.log(`[Referral] Subscription bonus awarded: ${REFERRAL_SUBSCRIPTION_BONUS} points to ${referral.referrer.email}`);
}

/**
 * Get referral link for email share
 */
export function getEmailShareContent(userName: string, referralLink: string): { subject: string; body: string } {
  return {
    subject: "Join me on Athletics Director Hub",
    body: `Hi! I'm using Athletics Director Hub to manage my athletic program and I think you'd love it too.

Sign up using my referral link and we both get rewards:
${referralLink}

${userName}`,
  };
}

/**
 * Get referral link for SMS share
 */
export function getSmsShareContent(referralLink: string): string {
  return `Join me on Athletics Director Hub! Sign up with my link and we both get rewards: ${referralLink}`;
}

/**
 * Send notification email to referrer when someone signs up
 */
export async function sendReferralSuccessEmail(referrerEmail: string, referrerName: string, newUserName: string, pointsAwarded: number): Promise<void> {
  if (!resend) {
    console.warn("[Referral] Email service not configured, skipping notification email");
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Athletics Director Hub <noreply@athleticsdirectorshub.com>",
      to: referrerEmail,
      subject: "🎉 Great news! Your referral just signed up",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Congratulations, ${referrerName}! 🎉</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            Great news! <strong>${newUserName}</strong> just signed up using your referral link.
          </p>
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1976d2;">You earned ${pointsAwarded} points!</h3>
            <p style="margin-bottom: 0;">Keep sharing your referral link to earn even more rewards.</p>
          </div>
          <p style="font-size: 14px; color: #666;">
            Thank you for helping us grow the Athletics Director Hub community!
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">
            Athletics Director Hub - Manage your athletic program with ease
          </p>
        </div>
      `,
    });
    console.log(`[Referral] Success email sent to ${referrerEmail}`);
  } catch (error) {
    console.error("[Referral] Failed to send success email:", error);
  }
}

/**
 * Send welcome email to new user who was referred
 */
export async function sendWelcomeReferralEmail(newUserEmail: string, newUserName: string, referrerName: string): Promise<void> {
  if (!resend) {
    console.warn("[Referral] Email service not configured, skipping welcome email");
    return;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Athletics Director Hub <noreply@athleticsdirectorshub.com>",
      to: newUserEmail,
      subject: "Welcome to Athletics Director Hub! 👋",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Welcome to Athletics Director Hub, ${newUserName}! 👋</h2>
          <p style="font-size: 16px; line-height: 1.6;">
            We're excited to have you join our community. You were referred by <strong>${referrerName}</strong>.
          </p>
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2e7d32;">Getting Started</h3>
            <ul style="line-height: 1.8;">
              <li>Set up your teams and opponents</li>
              <li>Create your game schedule</li>
              <li>Sync with Google Calendar</li>
              <li>Manage communications and emails</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: #666;">
            If you have any questions, feel free to reach out to our support team.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">
            Athletics Director Hub - Manage your athletic program with ease
          </p>
        </div>
      `,
    });
    console.log(`[Referral] Welcome email sent to ${newUserEmail}`);
  } catch (error) {
    console.error("[Referral] Failed to send welcome email:", error);
  }
}
