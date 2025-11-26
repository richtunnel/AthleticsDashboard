import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { emailLimitService } from "@/lib/services/email-limit.service";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

/**
 * GET /api/email/limits
 * Get email usage statistics for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiResponse.unauthorized();
    }

    const stats = await emailLimitService.getUserEmailStats(session.user.id);

    return ApiResponse.success({
      daily: {
        used: stats.dailyUsed,
        limit: stats.dailyLimit,
        remaining: stats.dailyRemaining,
        percentage: Math.round((stats.dailyUsed / stats.dailyLimit) * 100),
      },
      monthly: {
        used: stats.monthlyUsed,
        limit: stats.monthlyLimit,
        remaining: stats.monthlyRemaining,
        percentage: Math.round((stats.monthlyUsed / stats.monthlyLimit) * 100),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
