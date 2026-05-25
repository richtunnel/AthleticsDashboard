import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { jobQueueService } from "@/lib/services/job-queue.service";

/**
 * Resolve the caller from EITHER an AD/collaborator session OR a parent
 * session. Returns { userId, organizationId } so the security check below
 * can be uniform regardless of which auth path was used.
 *
 * This is required because parent-triggered sync jobs are polled by parents,
 * and parents authenticate via a separate session cookie.
 */
async function resolveAnyCaller(): Promise<{ userId: string; organizationId: string | null } | null> {
  try {
    const adSession = await requireAuth();
    return {
      userId: adSession.user.id,
      organizationId: adSession.user.organizationId ?? null,
    };
  } catch {
    /* fall through to parent session */
  }

  const parentSession = await getParentSession();
  if (!parentSession?.user?.email) return null;
  const parent = await prisma.user.findUnique({
    where: { email: parentSession.user.email },
    select: { id: true, organizationId: true },
  });
  return parent ? { userId: parent.id, organizationId: parent.organizationId } : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await resolveAnyCaller();
    if (!caller) {
      return ApiResponse.error("Unauthorized", 401);
    }
    const { id } = await params;

    const job = await jobQueueService.getJob(id);

    if (!job) {
      return ApiResponse.error("Job not found", 404);
    }

    // Security check: owner OR same-org staff can read it
    const isOwner = job.userId === caller.userId;
    const isOrgStaff =
      job.organizationId != null && job.organizationId === caller.organizationId;
    if (!isOwner && !isOrgStaff) {
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