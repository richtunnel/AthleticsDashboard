import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { calendarService } from "@/lib/services/calendar.services";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const result = await calendarService.syncGameToCalendar(params.id, session.user.id);
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAuth();
    const result = await calendarService.unsyncGame(params.id, session.user.id);
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
