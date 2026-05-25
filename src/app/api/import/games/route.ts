import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/utils/error-handler";
import { ApiResponse } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/utils/auth";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file provided");
    }

    const csvContent = await file.text();

    const job = await jobQueueService.enqueue({
      type: JobType.GAME_IMPORT,
      payload: {
        csvContent,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      userId: session.user.id,
      organizationId: session.user.organizationId,
    });

    // Dispatch to BullMQ for instant pickup
    const { gameImportQueue } = await import("@/lib/queue/queues");
    await gameImportQueue.add("import", {
      backgroundJobId: job.id,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      csvContent,
    });

    return ApiResponse.success({ jobId: job.id });
  } catch (error) {
    return await handleApiError(error);
  }
}
