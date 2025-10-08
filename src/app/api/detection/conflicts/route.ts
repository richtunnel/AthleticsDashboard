import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { travelService } from "@/lib/services/travel.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const conflicts = await travelService.detectScheduleConflicts(session.user.organizationId);

    return ApiResponse.success(conflicts);
  } catch (error) {
    return handleApiError(error);
  }
}
