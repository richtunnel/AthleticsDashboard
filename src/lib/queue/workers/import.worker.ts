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
export const gameImportWorker = new Worker<GameImportPayload>(
  `${QUEUE_PREFIX}-game-import`,
  async (job: Job<GameImportPayload>) => {
    return await importExportService.processImportJob({
      ...job.data,
      jobId: job.data.backgroundJobId,
    });
  },
  {
    connection: bullConnection,
    concurrency: 2,
  }
);

gameImportWorker.on("failed", (job, err) => {
  console.error(`[gameImportWorker] job ${job?.id} failed:`, err.message);
});

/**
 * Email import worker — bulk email list ingestion.
 */
export const emailImportWorker = new Worker<EmailImportPayload>(
  `${QUEUE_PREFIX}-email-import`,
  async (job: Job<EmailImportPayload>) => {
    return await emailImportService.processImportJob({
      ...job.data,
      jobId: job.data.backgroundJobId,
    });
  },
  {
    connection: bullConnection,
    concurrency: 2,
  }
);

emailImportWorker.on("failed", (job, err) => {
  console.error(`[emailImportWorker] job ${job?.id} failed:`, err.message);
});
