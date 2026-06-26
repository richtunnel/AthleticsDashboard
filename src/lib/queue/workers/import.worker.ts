import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { GameImportPayload, EmailImportPayload } from "../queues";
import { importExportService } from "../../services/import-export.service";
import { emailImportService } from "../../services/email-import.service";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Game import worker — spreadsheet → games. Long-running, so concurrency=2
 * to prevent OOM from multiple parallel CSV/Sheets parses.
 */
// Imports can process large CSV/Sheets files and may run for several minutes.
// lockDuration must exceed the maximum expected runtime so BullMQ doesn't
// consider an in-progress job stalled and re-queue it, causing duplicate imports.
const IMPORT_LOCK_DURATION_MS = 10 * 60 * 1000; // 10 min

export const gameImportWorker = new Worker<GameImportPayload>(
  `${QUEUE_PREFIX}-game-import`,
  async (job: Job<GameImportPayload>) => {
    return await importExportService.processImportJob({
      ...job.data as any,
      jobId: (job.data as any).backgroundJobId,
    } as any);
  },
  {
    connection: bullConnection,
    concurrency: 2,
    lockDuration: IMPORT_LOCK_DURATION_MS,
    settings: {
      stalledInterval: 30_000, // check for stalled jobs every 30s
      maxStalledCount: 1,      // re-queue once; fail permanently on second stall
    },
  }
);

gameImportWorker.on("failed", (job, err) => {
  console.error(`[gameImportWorker] job ${job?.id} failed:`, err.message);
});
gameImportWorker.on("error", (err) => {
  console.error("[gameImportWorker] worker error:", err.message);
});
gameImportWorker.on("stalled", (jobId) => {
  console.warn(`[gameImportWorker] job ${jobId} stalled — re-queued for retry`);
});

/**
 * Email import worker — bulk email list ingestion.
 */
export const emailImportWorker = new Worker<EmailImportPayload>(
  `${QUEUE_PREFIX}-email-import`,
  async (job: Job<EmailImportPayload>) => {
    return await emailImportService.processImportJob({
      ...job.data as any,
      jobId: (job.data as any).backgroundJobId,
    } as any);
  },
  {
    connection: bullConnection,
    concurrency: 2,
    lockDuration: IMPORT_LOCK_DURATION_MS,
    settings: {
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
  }
);

emailImportWorker.on("failed", (job, err) => {
  console.error(`[emailImportWorker] job ${job?.id} failed:`, err.message);
});
emailImportWorker.on("error", (err) => {
  console.error("[emailImportWorker] worker error:", err.message);
});
emailImportWorker.on("stalled", (jobId) => {
  console.warn(`[emailImportWorker] job ${jobId} stalled — re-queued for retry`);
});
