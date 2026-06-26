import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { CalendarSyncPayload } from "../queues";
import { calendarService } from "../../services/calendar.service";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Calendar sync worker — concurrency-limited to respect Google Calendar API
 * quotas (default 600 requests/min/user). 5 parallel syncs leaves headroom.
 */
// A full org calendar sync can take several minutes for large game sets.
// lockDuration must exceed the worst-case runtime to prevent stale detection
// from re-queuing an in-progress sync and causing duplicate calendar writes.
export const calendarSyncWorker = new Worker<CalendarSyncPayload>(
  `${QUEUE_PREFIX}-calendar-sync`,
  async (job: Job<CalendarSyncPayload>) => {
    const { userId, organizationId, backgroundJobId } = job.data;
    return await calendarService.syncAllGames(userId, organizationId, backgroundJobId);
  },
  {
    connection: bullConnection,
    concurrency: 5,
    lockDuration: 10 * 60 * 1000, // 10 min — covers full-org syncs
    limiter: {
      max: 30,
      duration: 60_000,
    },
    settings: {
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
  }
);

calendarSyncWorker.on("failed", (job, err) => {
  console.error(`[calendarSyncWorker] job ${job?.id} failed:`, err.message);
});
calendarSyncWorker.on("error", (err) => {
  console.error("[calendarSyncWorker] worker error:", err.message);
});
calendarSyncWorker.on("stalled", (jobId) => {
  console.warn(`[calendarSyncWorker] job ${jobId} stalled — re-queued for retry`);
});
