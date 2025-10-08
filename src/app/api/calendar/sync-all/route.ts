import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { calendarService } from "@/lib/services/calendar.services";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const results = await calendarService.syncAllGames(session.user.id, session.user.organizationId);

    return ApiResponse.success(results);
  } catch (error) {
    return handleApiError(error);
  }
}
