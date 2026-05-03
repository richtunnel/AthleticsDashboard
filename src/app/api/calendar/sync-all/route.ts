import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const job = await jobQueueService.enqueue({
      type: JobType.CALENDAR_SYNC,
      payload: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      userId: session.user.id,
      organizationId: session.user.organizationId,
    });

    return ApiResponse.success({ jobId: job.id });
  } catch (error) {
    return await handleApiError(error);
  }
}
