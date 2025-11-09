import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { aiSchedulerService } from "@/lib/services/aiScheduler.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { opponentName, sport, teamLevel, preferredDates, preferredTimes, homeOrAway } = body;

    if (!opponentName || !sport || !teamLevel || !homeOrAway) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: opponentName, sport, teamLevel, homeOrAway",
        },
        { status: 400 }
      );
    }

    const suggestion = await aiSchedulerService.suggestSchedule(session.user.organizationId, {
      opponentName,
      sport,
      teamLevel,
      preferredDates,
      preferredTimes,
      homeOrAway,
    });

    return NextResponse.json({
      success: true,
      suggestion,
    });
  } catch (error) {
    console.error("Failed to generate suggestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate suggestion",
      },
      { status: 500 }
    );
  }
}
