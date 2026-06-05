import { prisma } from "../database/prisma";
import { getEmailLimit } from "../security/plan-limits";
import { REDIS_ENABLED, REDIS_URL } from "../redis/enabled";
import IORedis from "ioredis";

// ── Redis client (lazy-init, reused across invocations) ───────────────────────
declare global { var _redisEmailLimit: IORedis | undefined; }
function getRedis(): IORedis | null {
  if (!REDIS_ENABLED) return null;
  if (!globalThis._redisEmailLimit) {
    globalThis._redisEmailLimit = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableReadyCheck: false,
    });
    globalThis._redisEmailLimit.on("error", () => { /* fail-open */ });
  }
  return globalThis._redisEmailLimit;
}

/**
 * Atomically increment an email send counter in Redis and return the new value.
 * If Redis is unavailable, returns null (caller falls back to DB count).
 * Keys:
 *   email:daily:{userId}:{YYYY-MM-DD}  — expires in 2 days
 *   email:monthly:{YYYY-MM}            — expires in 35 days (global system limit)
 */
async function redisIncrEmailCount(key: string, ttlSec: number): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSec, "NX"); // only set TTL on first INCR
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? null;
  } catch {
    return null; // fail-open: fall back to DB
  }
}

async function redisGetCount(key: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v === null ? null : parseInt(v, 10);
  } catch { return null; }
}

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
   * Check both user daily and system monthly limits.
   * Uses atomic Redis INCR when Redis is available to prevent race conditions
   * between concurrent send requests from the same user.
   * Falls back to DB counts when Redis is unavailable (fail-open).
   */
  async checkEmailLimits(userId: string, emailCount: number = 1): Promise<EmailLimitCheck> {
    const now    = new Date();
    const dateKey  = now.toISOString().slice(0, 10);                       // YYYY-MM-DD
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM

    // ── Atomic reservation via Redis ──────────────────────────────────────────
    // INCR claims the send slots before the DB write. If the limit is exceeded
    // we DECR to release the reservation. This prevents the race where two
    // concurrent requests both read the same DB count and both proceed.
    const dailyRedisKey   = `email:daily:${userId}:${dateKey}`;
    const monthlyRedisKey = `email:monthly:${monthKey}`;

    const [redisDailyAfter, redisMonthlyAfter] = await Promise.all([
      redisIncrEmailCount(dailyRedisKey,   2 * 24 * 3600),   // 2 days TTL
      redisIncrEmailCount(monthlyRedisKey, 35 * 24 * 3600),  // 35 days TTL
    ]);

    if (redisDailyAfter !== null && redisMonthlyAfter !== null) {
      // Redis atomic path — no DB count queries needed
      const dailyLimit   = EMAIL_LIMITS.DAILY_PER_USER;
      const monthlyLimit = await getEmailLimit(userId);
      const systemLimit  = EMAIL_LIMITS.MONTHLY_GLOBAL;

      if (redisDailyAfter > dailyLimit) {
        // Release reservation
        await Promise.all([
          getRedis()?.decrby(dailyRedisKey, emailCount),
          getRedis()?.decrby(monthlyRedisKey, emailCount),
        ]).catch(() => {});
        return { allowed: false, reason: `Daily email limit of ${dailyLimit} exceeded.`, dailyUsed: redisDailyAfter - emailCount, dailyLimit };
      }
      if (redisMonthlyAfter > monthlyLimit) {
        await Promise.all([
          getRedis()?.decrby(dailyRedisKey, emailCount),
          getRedis()?.decrby(monthlyRedisKey, emailCount),
        ]).catch(() => {});
        return { allowed: false, reason: `Monthly plan limit of ${monthlyLimit.toLocaleString()} exceeded.`, monthlyUsed: redisMonthlyAfter - emailCount, monthlyLimit };
      }
      if (redisMonthlyAfter > systemLimit) {
        await Promise.all([
          getRedis()?.decrby(dailyRedisKey, emailCount),
          getRedis()?.decrby(monthlyRedisKey, emailCount),
        ]).catch(() => {});
        return { allowed: false, reason: "System monthly email limit exceeded. Please contact support.", monthlyUsed: redisMonthlyAfter - emailCount, monthlyLimit: systemLimit };
      }
      return { allowed: true, dailyUsed: redisDailyAfter, dailyLimit, monthlyUsed: redisMonthlyAfter, monthlyLimit };
    }

    // ── DB fallback (Redis unavailable) ──────────────────────────────────────
    const userCheck = await this.canUserSendEmails(userId, emailCount);
    if (!userCheck.allowed) return userCheck;

    const userMonthlyCheck = await this.canUserSendMonthlyEmails(userId, emailCount);
    if (!userMonthlyCheck.allowed) return userMonthlyCheck;

    const systemCheck = await this.canSystemSendEmails(emailCount);
    if (!systemCheck.allowed) return systemCheck;

    return {
      allowed: true,
      dailyUsed: userCheck.dailyUsed,
      dailyLimit: userCheck.dailyLimit,
      monthlyUsed: userMonthlyCheck.monthlyUsed,
      monthlyLimit: userMonthlyCheck.monthlyLimit,
    };
  }

  /**
   * Atomically record sent emails in Redis counters (called after successful send).
   * Keeps Redis in sync when the DB-fallback path was used.
   */
  async recordSentEmails(userId: string, count: number): Promise<void> {
    const now      = new Date();
    const dateKey  = now.toISOString().slice(0, 10);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await Promise.all([
      redisIncrEmailCount(`email:daily:${userId}:${dateKey}`,   2  * 24 * 3600),
      redisIncrEmailCount(`email:monthly:${monthKey}`,          35 * 24 * 3600),
    ]).catch(() => {});
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
          createdAt: { gte: firstDayOfMonth },
        },
        status: { in: ["PENDING", "RETRYING"] },
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
          createdAt: { gte: twentyFourHoursAgo },
        },
        status: { in: ["PENDING", "RETRYING"] },
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
