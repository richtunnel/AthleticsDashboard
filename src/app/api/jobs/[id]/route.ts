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
    if (job.userId && job.userId !== session.user.id && job.organizationId !== session.user.organizationId) {
      return ApiResponse.error("Unauthorized", 403);
    }

    // For org-level jobs, verify the user belongs to this org
    if (!job.userId && job.organizationId && job.organizationId !== session.user.organizationId) {
      return ApiResponse.error("Unauthorized", 403);
    }

    return ApiResponse.success({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    });
  } catch (error) {
    return await handleApiError(error);
  }
}

// Cancel a pending job
export async function DELETE(
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

    // Security check
    if (job.userId && job.userId !== session.user.id && job.organizationId !== session.user.organizationId) {
      return ApiResponse.error("Unauthorized", 403);
    }

    if (!job.userId && job.organizationId && job.organizationId !== session.user.organizationId) {
      return ApiResponse.error("Unauthorized", 403);
    }

    const cancelled = await jobQueueService.cancel(id);

    if (!cancelled) {
      return ApiResponse.error("Cannot cancel job - job is not in pending state", 400);
    }

    return ApiResponse.success({ cancelled: true });
  } catch (error) {
    return await handleApiError(error);
  }
}