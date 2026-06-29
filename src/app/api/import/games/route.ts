import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/utils/error-handler";
import { ApiResponse } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/utils/auth";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType } from "@prisma/client";
import { uploadImportFile, S3_CONFIGURED } from "@/lib/utils/s3";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!S3_CONFIGURED) {
      return ApiResponse.error("File storage is not configured. Contact support.");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file provided");
    }

    const csvContent = await file.text();

    // Create the BackgroundJob row first so we have an ID for the Spaces key
    const job = await jobQueueService.enqueue({
      type: JobType.GAME_IMPORT,
      payload: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      userId: session.user.id,
      organizationId: session.user.organizationId,
    });

    // Upload CSV to Spaces — store only the key in job payloads, not the raw content
    const s3Key = await uploadImportFile(session.user.organizationId, job.id, csvContent);

    // Dispatch to BullMQ with the key instead of the raw CSV
    const { gameImportQueue } = await import("@/lib/queue/queues");
    await gameImportQueue.add("import", {
      backgroundJobId: job.id,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      s3Key,
    });

    return ApiResponse.success({ jobId: job.id });
  } catch (error) {
    return await handleApiError(error);
  }
}
