import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { jobQueueService } from "@/lib/services/job-queue.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const job = await jobQueueService.getJob(id);

    if (!job) {
      return ApiResponse.error("Job not found", 404);
    }

    // Security check: only the user or someone from the same org can see the job
    if (job.userId !== session.user.id && job.organizationId !== session.user.organizationId) {
      return ApiResponse.error("Unauthorized", 403);
    }

    return ApiResponse.success({
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
      result: job.result,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    });
  } catch (error) {
    return await handleApiError(error);
  }
}
