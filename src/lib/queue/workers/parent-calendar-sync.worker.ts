import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { ParentCalendarSyncPayload } from "../queues";
import { calendarService } from "../../services/calendar.service";
import { prisma } from "../../database/prisma";
import { publishChatEvent } from "../../chat/eventBus";
import { JobStatus } from "@prisma/client";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Parent-side calendar sync worker.
 *
 * Lifecycle events are published to a per-job Redis channel
 * (`syncjob:{backgroundJobId}`) so the SSE endpoint can stream them to the
 * client without polling. The BackgroundJob row is updated in lock-step so
 * the polling fallback (`GET /api/jobs/{id}`) always reflects current state.
 *
 * Retry policy: BullMQ retries failed jobs up to `attempts` times with
 * exponential backoff (see queues.ts defaults). On final failure we set
 * status=FAILED and publish a `failed` event with the error message.
 */
export const parentCalendarSyncWorker = new Worker<ParentCalendarSyncPayload>(
  `${QUEUE_PREFIX}-parent-calendar-sync`,
  async (job: Job<ParentCalendarSyncPayload>) => {
    const {
      backgroundJobId,
      parentUserId,
      syncRequestId,
      schoolId,
      sportName,
      sportLevel,
      googleCalendarId,
    } = job.data;

    const channel = `syncjob:${backgroundJobId}`;

    // ── Mark RUNNING ──────────────────────────────────────────────────────
    await prisma.backgroundJob.update({
      where: { id: backgroundJobId },
      data: { status: JobStatus.PROCESSING, lastAttemptAt: new Date() },
    }).catch(() => { /* row may have been GC'd; carry on */ });

    publishChatEvent(channel, {
      type: "job_running",
      jobId: backgroundJobId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 5,
    });

    // ── Do the work ───────────────────────────────────────────────────────
    const results = await calendarService.syncGamesForSportLevel(
      parentUserId,
      schoolId,
      sportName,
      sportLevel,
      googleCalendarId
    );

    const added = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const firstError = results.find((r) => !r.ok)?.error ?? null;

    // Treat "every single push failed" as a retryable error so BullMQ kicks
    // in its exponential backoff. Partial failures = success-with-warnings.
    if (added === 0 && failed > 0) {
      throw new Error(firstError ?? "All game pushes failed");
    }

    // ── Mark COMPLETED ────────────────────────────────────────────────────
    const result = { added, failed, firstError };

    await prisma.backgroundJob.update({
      where: { id: backgroundJobId },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        result,
      },
    }).catch(() => {});

    // Mirror the success on ConnectedParent so the AD's view shows it
    await prisma.connectedParent.updateMany({
      where: { parentUserId, schoolId },
      data: { calendarSynced: true, lastSyncedAt: new Date() },
    }).catch(() => {});

    // Persist the chosen calendar so future syncs know where to push
    await prisma.calendarSyncRequest.update({
      where: { id: syncRequestId },
      data: { googleCalendarId },
    }).catch(() => {});

    publishChatEvent(channel, {
      type: "job_completed",
      jobId: backgroundJobId,
      result,
    });

    return result;
  },
  {
    connection: bullConnection,
    concurrency: 5,
    limiter: { max: 30, duration: 60_000 }, // 30 jobs / min global ceiling
  }
);

// Final-failure handler — after BullMQ exhausts retries
parentCalendarSyncWorker.on("failed", async (job, err) => {
  if (!job) return;

  // BullMQ fires this on every failed attempt. Only mark the row failed
  // on the LAST attempt so the UI doesn't flicker between RUNNING/FAILED.
  const isFinal = job.attemptsMade >= (job.opts.attempts ?? 5);
  if (!isFinal) return;

  const { backgroundJobId } = job.data;
  const channel = `syncjob:${backgroundJobId}`;

  await prisma.backgroundJob.update({
    where: { id: backgroundJobId },
    data: {
      status: JobStatus.FAILED,
      failedAt: new Date(),
      error: err.message.slice(0, 500),
    },
  }).catch(() => {});

  publishChatEvent(channel, {
    type: "job_failed",
    jobId: backgroundJobId,
    error: err.message,
  });

  console.error(`[parentCalendarSyncWorker] job ${backgroundJobId} failed after ${job.attemptsMade} attempts:`, err.message);
});
