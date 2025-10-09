import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { calendarService } from "@/lib/services/calendar.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params; // AWAIT the params first
    const result = await calendarService.syncGameToCalendar(id, session.user.id);
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params; // AWAIT the params first
    const result = await calendarService.unsyncGame(id, session.user.id);
    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
