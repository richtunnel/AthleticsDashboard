import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";
import { sendEmailSchema } from "@/lib/validations/games";
import { emailService } from "@/lib/services/email.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const validatedData = sendEmailSchema.parse(body);

    const result = await emailService.sendEmail({
      ...validatedData,
      sentById: session.user.id,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
