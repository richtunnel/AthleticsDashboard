import { prisma } from "../database/prisma";
import { getEmailLimit } from "../security/plan-limits";

export const EMAIL_LIMITS = {
  DAILY_PER_USER: 75,
  MONTHLY_GLOBAL: 100000,
} as const;

interface EmailLimitCheck {
  allowed: boolean;
  reason?: string;
  dailyUsed?: number;
  dailyLimit?: number;
  monthlyUsed?: number;
  monthlyLimit?: number;
}

export class EmailLimitService {
  /**
   * Check if a user can send a specified number of emails based on daily limit
   */
  async canUserSendEmails(userId: string, emailCount: number = 1): Promise<EmailLimitCheck> {
    const dailyUsed = await this.getUserDailyEmailCount(userId);
    const dailyLimit = EMAIL_LIMITS.DAILY_PER_USER;
    const remaining = dailyLimit - dailyUsed;

    if (dailyUsed + emailCount > dailyLimit) {
      return {
        allowed: false,
        reason: `Daily email limit exceeded. You have sent ${dailyUsed} of ${dailyLimit} emails today. ${remaining > 0 ? `You can send ${remaining} more email${remaining === 1 ? '' : 's'}.` : 'Please try again tomorrow.'}`,
        dailyUsed,
        dailyLimit,
      };
    }

    return {
      allowed: true,
      dailyUsed,
      dailyLimit,
    };
  }

  /**
   * Check if the system can send a specified number of emails based on monthly limit
   */
  async canSystemSendEmails(emailCount: number = 1): Promise<EmailLimitCheck> {
    const monthlyUsed = await this.getGlobalMonthlyEmailCount();
    const monthlyLimit = EMAIL_LIMITS.MONTHLY_GLOBAL;
    const remaining = monthlyLimit - monthlyUsed;

    if (monthlyUsed + emailCount > monthlyLimit) {
      return {
        allowed: false,
        reason: `System-wide monthly email limit reached. ${monthlyUsed.toLocaleString()} of ${monthlyLimit.toLocaleString()} emails sent this month. ${remaining > 0 ? `${remaining.toLocaleString()} remaining.` : 'Limit will reset at the start of next month.'}`,
        monthlyUsed,
        monthlyLimit,
      };
    }

    return {
      allowed: true,
      monthlyUsed,
      monthlyLimit,
    };
  }

  /**
   * Check both user daily and system monthly limits
   */
  async checkEmailLimits(userId: string, emailCount: number = 1): Promise<EmailLimitCheck> {
    // Check user daily limit first
    const userCheck = await this.canUserSendEmails(userId, emailCount);
    if (!userCheck.allowed) {
      return userCheck;
    }

    // Check user monthly limit based on plan
    const userMonthlyCheck = await this.canUserSendMonthlyEmails(userId, emailCount);
    if (!userMonthlyCheck.allowed) {
      return userMonthlyCheck;
    }

    // Check system monthly limit
    const systemCheck = await this.canSystemSendEmails(emailCount);
    if (!systemCheck.allowed) {
      return systemCheck;
    }

    return {
      allowed: true,
      dailyUsed: userCheck.dailyUsed,
      dailyLimit: userCheck.dailyLimit,
      monthlyUsed: userMonthlyCheck.monthlyUsed,
      monthlyLimit: userMonthlyCheck.monthlyLimit,
    };
  }

  /**
   * Check if a user can send a specified number of emails based on their plan's monthly limit
   */
  async canUserSendMonthlyEmails(userId: string, emailCount: number = 1): Promise<EmailLimitCheck> {
    const monthlyUsed = await this.getUserMonthlyEmailCount(userId);
    const monthlyLimit = await getEmailLimit(userId);
    const remaining = monthlyLimit - monthlyUsed;

    if (monthlyUsed + emailCount > monthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly email limit for your plan exceeded. You have sent ${monthlyUsed.toLocaleString()} of ${monthlyLimit.toLocaleString()} emails this month. ${remaining > 0 ? `You can send ${remaining.toLocaleString()} more emails.` : 'Please upgrade your plan to increase your limit.'}`,
        monthlyUsed,
        monthlyLimit,
      };
    }

    return {
      allowed: true,
      monthlyUsed,
      monthlyLimit,
    };
  }

  /**
   * Get the count of emails sent by a user in the current month
   */
  async getUserMonthlyEmailCount(userId: string): Promise<number> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const sentCount = await prisma.emailLog.count({
      where: {
        sentById: userId,
        status: "SENT",
        sentAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    const enqueuedCount = await prisma.emailRecipient.count({
      where: {
        job: {
          userId,
        },
        status: {
          in: ["PENDING", "RETRYING"],
        },
        job: {
          createdAt: {
            gte: firstDayOfMonth,
          },
        },
      },
    });

    return sentCount + enqueuedCount;
  }

  /**
   * Get the count of emails sent by a user in the last 24 hours
   */
  async getUserDailyEmailCount(userId: string): Promise<number> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const sentCount = await prisma.emailLog.count({
      where: {
        sentById: userId,
        status: "SENT",
        sentAt: {
          gte: twentyFourHoursAgo,
        },
      },
    });

    const enqueuedCount = await prisma.emailRecipient.count({
      where: {
        job: {
          userId,
        },
        status: {
          in: ["PENDING", "RETRYING"],
        },
        job: {
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
      },
    });

    return sentCount + enqueuedCount;
  }

  /**
   * Get the count of all emails sent system-wide in the current month
   */
  async getGlobalMonthlyEmailCount(): Promise<number> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const sentCount = await prisma.emailLog.count({
      where: {
        status: "SENT",
        sentAt: {
          gte: firstDayOfMonth,
        },
      },
    });

    const enqueuedCount = await prisma.emailRecipient.count({
      where: {
        status: {
          in: ["PENDING", "RETRYING"],
        },
        job: {
          createdAt: {
            gte: firstDayOfMonth,
          },
        },
      },
    });

    return sentCount + enqueuedCount;
  }

  /**
   * Get email usage statistics for a user
   */
  async getUserEmailStats(userId: string): Promise<{
    dailyUsed: number;
    dailyLimit: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyLimit: number;
    monthlyRemaining: number;
  }> {
    const dailyUsed = await this.getUserDailyEmailCount(userId);
    const monthlyUsed = await this.getUserMonthlyEmailCount(userId);
    const dailyLimit = EMAIL_LIMITS.DAILY_PER_USER;
    const monthlyLimit = await getEmailLimit(userId);

    return {
      dailyUsed,
      dailyLimit,
      dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
      monthlyUsed,
      monthlyLimit,
      monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
    };
  }
}

export const emailLimitService = new EmailLimitService();
