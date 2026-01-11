import { NextRequest, NextResponse } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { calendarSyncTrackerService } from "@/lib/services/calendar-sync-tracker.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recalculate = searchParams.get("recalculate") === "true";

    let count: number;

    if (recalculate) {
      count = await calendarSyncTrackerService.recalculateSyncedUserCount();
    } else {
      count = await calendarSyncTrackerService.getSyncedUserCount();
    }

    return ApiResponse.success({
      syncedUsers: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
