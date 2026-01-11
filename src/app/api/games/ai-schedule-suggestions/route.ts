import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { schedulerAIService } from "@/lib/services/scheduler-ai.service";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.FIND_DATES);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "This feature is not available on your current plan. Please upgrade to Team or Team Plus to use AI schedule suggestions." },
        { status: 403 }
      );
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await req.json();
    const { sportId, teamId, opponentId, preferredDateRange, preferredTimes, isHome } = body;

    if (!sportId || !teamId) {
      return NextResponse.json(
        { error: "sportId and teamId are required" },
        { status: 400 }
      );
    }

    const dateRange = preferredDateRange
      ? {
          start: new Date(preferredDateRange.start),
          end: new Date(preferredDateRange.end),
        }
      : undefined;

    const suggestions = await schedulerAIService.suggestGameSlots(organizationId, {
      sportId,
      teamId,
      opponentId,
      preferredDateRange: dateRange,
      preferredTimes,
      isHome,
    });

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("AI schedule suggestions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
