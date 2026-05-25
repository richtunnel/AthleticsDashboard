import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { CalendarSyncPayload } from "../queues";
import { calendarService } from "../../services/calendar.service";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Calendar sync worker — concurrency-limited to respect Google Calendar API
 * quotas (default 600 requests/min/user). 5 parallel syncs leaves headroom.
 */
export const calendarSyncWorker = new Worker<CalendarSyncPayload>(
  `${QUEUE_PREFIX}-calendar-sync`,
  async (job: Job<CalendarSyncPayload>) => {
    const { userId, organizationId, backgroundJobId } = job.data;
    return await calendarService.syncAllGames(userId, organizationId, backgroundJobId);
  },
  {
    connection: bullConnection,
    concurrency: 5,
    limiter: {
      max: 30,           // 30 jobs
      duration: 60_000,  // per minute (global)
    },
  }
);

calendarSyncWorker.on("failed", (job, err) => {
  console.error(`[calendarSyncWorker] job ${job?.id} failed:`, err.message);
});
