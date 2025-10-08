import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { travelService } from "@/lib/services/travel.service";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();

    const recommendation = await travelService.getAIRecommendation(params.id, session.user.organizationId);

    return ApiResponse.success(recommendation);
  } catch (error) {
    return handleApiError(error);
  }
}
