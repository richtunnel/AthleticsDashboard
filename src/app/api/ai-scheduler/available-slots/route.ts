import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { aiSchedulerService } from "@/lib/services/aiScheduler.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const searchParams = request.nextUrl.searchParams;

    const sport = searchParams.get("sport") || undefined;
    const teamLevel = searchParams.get("teamLevel") || undefined;
    const daysAhead = parseInt(searchParams.get("daysAhead") || "30");

    const availableSlots = await aiSchedulerService.findAvailableSlots(
      session.user.organizationId,
      sport,
      teamLevel,
      daysAhead
    );

    return NextResponse.json({
      success: true,
      slots: availableSlots,
    });
  } catch (error) {
    console.error("Failed to find available slots:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to find available slots",
      },
      { status: 500 }
    );
  }
}
