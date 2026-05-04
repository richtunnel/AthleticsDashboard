import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth } from "@/lib/utils/auth";
import { calendarService } from "@/lib/services/calendar.service";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Parse request body for optional filters
    let body: { sportFilter?: { name: string; level: string; gender?: string }; gameIds?: string[] } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // Ignore parse errors, use defaults
    }

    // Enqueue the calendar sync job
    const result = await calendarService.enqueueCalendarSync(
      session.user.id,
      session.user.organizationId,
      {
        sportFilter: body.sportFilter,
        gameIds: body.gameIds,
      }
    );

    return ApiResponse.success({
      jobId: result.jobId,
      message: "Calendar sync job enqueued. Poll the job status endpoint for progress.",
      statusUrl: `/api/jobs/${result.jobId}`,
    });
  } catch (error) {
    return await handleApiError(error);
  }
}

// GET - Get calendar sync status/progress
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      // Get specific job status
      const progress = await calendarService.getSyncProgress(jobId);
      
      if (!progress) {
        return ApiResponse.error("Job not found", 404);
      }

      return ApiResponse.success({
        jobId,
        progress,
        status: progress.synced + progress.failed + progress.skipped >= progress.total ? "completed" : "in_progress",
      });
    }

    // List recent calendar sync jobs for this organization
    const jobs = await jobQueueService.getJobsByOrganization(session.user.organizationId, {
      type: JobType.CALENDAR_SYNC,
      limit: 10,
    });

    return ApiResponse.success({
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        attempts: job.attempts,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    });
  } catch (error) {
    return await handleApiError(error);
  }
}