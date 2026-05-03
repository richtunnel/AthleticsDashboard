import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType, JobStatus } from "@prisma/client";

// GET - List jobs for the user's organization
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as JobType | null;
    const status = searchParams.get("status") as JobStatus | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const jobs = await jobQueueService.getJobsByOrganization(session.user.organizationId, {
      type: type || undefined,
      status: status || undefined,
      limit,
      offset,
    });

    return ApiResponse.success({
      jobs,
      pagination: {
        limit,
        offset,
        hasMore: jobs.length === limit,
      },
    });
  } catch (error) {
    return await handleApiError(error);
  }
}