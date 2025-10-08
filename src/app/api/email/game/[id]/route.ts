import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";
import { emailService } from "@/lib/services/email.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();

    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      return ApiResponse.forbidden();
    }

    const { id } = await params;
    const body = await request.json();
    const { recipients } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return ApiResponse.error("Recipients are required");
    }

    const result = await emailService.sendGameNotification(id, recipients, session.user.id);

    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
