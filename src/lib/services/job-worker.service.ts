import { prisma } from "../database/prisma";
import { JobType, JobStatus, BackgroundJob } from "@prisma/client";
import { emailGatewayService } from "./email-gateway.service";
import { calendarService } from "./calendar.service";
import { importExportService } from "./import-export.service";
import { emailImportService } from "./email-import.service";
import { stripeWebhookService } from "./stripe-webhook.service";
import { jobQueueService } from "./job-queue.service";

export type JobHandler = (payload: any, job: BackgroundJob) => Promise<any>;

const BASE_BACKOFF_MS = 1000;
const MAX_RUNTIME_MS = 55000;

export class JobWorker {
  private handlers: Partial<Record<JobType, JobHandler>> = {
    [JobType.EMAIL]: async (payload) => {
      return await emailGatewayService.send(payload);
    },
    [JobType.STRIPE_WEBHOOK]: async (payload) => {
      return await stripeWebhookService.processWebhookEvent(payload);
    },
    [JobType.CALENDAR_SYNC]: async (payload, job) => {
      // Pass jobId so the sync can update progress
      return await calendarService.syncAllGames(payload.userId, payload.organizationId, job.id);
    },
    [JobType.GAME_IMPORT]: async (payload, job) => {
      // Pass jobId so the import can update progress
      return await importExportService.processImportJob({ ...payload, jobId: job.id });
    },
    [JobType.EMAIL_IMPORT]: async (payload, job) => {
      return await emailImportService.processImportJob({ ...payload, jobId: job.id });
    },
  };

  /**
   * Process a single job with proper error handling and requeue logic
   */
  async processNextJob(): Promise<boolean> {
    const startTime = Date.now();
    const job = await this.acquireJob();
    
    if (!job) return false;

    console.log(`[JobWorker] Processing job ${job.id} of type ${job.type} (attempt ${job.attempts + 1}/${job.maxAttempts})`);

    try {
      const handler = this.handlers[job.type];
      if (!handler) {
        throw new Error(`No handler for job type: ${job.type}`);
      }

      // Execute the handler
      const result = await handler(job.payload, job);
      
      // Mark as completed
      await jobQueueService.complete(job.id, result);
      console.log(`[JobWorker] Job ${job.id} completed successfully`);
      
      return true;
    } catch (error: any) {
      console.error(`[JobWorker] Error processing job ${job.id}:`, error);
      
      // Determine if we should retry with exponential backoff
      const shouldRetry = job.attempts + 1 < job.maxAttempts;
      const errorMessage = error.message || String(error);
      
      if (shouldRetry) {
        // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s...
        const backoffMs = BASE_BACKOFF_MS * Math.pow(2, job.attempts);
        const nextAttemptAt = new Date(Date.now() + backoffMs);
        
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.PENDING,
            error: errorMessage,
            attempts: { increment: 1 },
            nextAttemptAt,
            lastAttemptAt: new Date(),
          },
        });
        
        console.log(`[JobWorker] Job ${job.id} requeued with backoff ${backoffMs}ms`);
      } else {
        // Max attempts reached, mark as permanently failed
        await jobQueueService.complete(job.id, {
          error: errorMessage,
          failedAt: new Date(),
        });
        
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            error: `Max attempts reached. Last error: ${errorMessage}`,
            failedAt: new Date(),
            nextAttemptAt: null,
          },
        });
        
        console.warn(`[JobWorker] Job ${job.id} permanently failed after ${job.maxAttempts} attempts`);
      }
    }

    // Check if we're running low on time for this invocation
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_RUNTIME_MS - 5000) {
      console.log(`[JobWorker] Runtime limit approaching (${elapsed}ms), stopping iteration`);
      return false;
    }

    return true;
  }

  /**
   * Run the worker continuously, processing jobs until time limit
   */
  async run(maxRuntimeMs: number = MAX_RUNTIME_MS): Promise<{ processed: number; errors: number }> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    console.log(`[JobWorker] Starting worker with max runtime ${maxRuntimeMs}ms`);

    try {
      while (Date.now() - startTime < maxRuntimeMs) {
        const jobAvailable = await this.processNextJob();
        
        if (!jobAvailable) {
          // No job available, wait before checking again
          await this.sleep(2000);
          
          // Check again after waiting
          if (Date.now() - startTime >= maxRuntimeMs - 2000) {
            break;
          }
          
          // Double check for jobs one more time
          const pendingCount = await prisma.backgroundJob.count({
            where: {
              status: JobStatus.PENDING,
              OR: [
                { nextAttemptAt: null },
                { nextAttemptAt: { lte: new Date() } },
              ],
            },
          });
          
          if (pendingCount === 0) {
            break;
          }
        } else {
          processed++;
        }

        // Check for errors in recent jobs (tracked via failedAt)
        const recentFailures = await prisma.backgroundJob.count({
          where: {
            failedAt: { gte: new Date(Date.now() - 60000) },
          },
        });
        
        if (recentFailures > 5) {
          console.warn(`[JobWorker] High failure rate detected (${recentFailures} in last minute), slowing down`);
          await this.sleep(5000);
        }
      }
    } catch (error) {
      console.error("[JobWorker] Worker run error:", error);
      errors++;
    }

    const totalTime = Date.now() - startTime;
    console.log(`[JobWorker] Worker finished. Processed: ${processed}, Errors: ${errors}, Runtime: ${totalTime}ms`);

    return { processed, errors };
  }

  /**
   * Acquire a job for processing using pessimistic locking
   */
  private async acquireJob(): Promise<BackgroundJob | null> {
    try {
      // Use SKIP LOCKED for concurrency-safe job acquisition in PostgreSQL
      const result = await prisma.$queryRaw<BackgroundJob[]>`
        UPDATE "BackgroundJob"
        SET "status" = 'PROCESSING', 
            "lastAttemptAt" = NOW(), 
            "updatedAt" = NOW(),
            "attempts" = "attempts" + 1
        WHERE "id" = (
          SELECT "id"
          FROM "BackgroundJob"
          WHERE "status" = 'PENDING'
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
          ORDER BY "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `;

      return result[0] || null;
    } catch (dbError) {
      console.error("[JobWorker] Error acquiring job with SKIP LOCKED, falling back:", dbError);
      return this.acquireJobFallback();
    }
  }

  /**
   * Fallback job acquisition without SKIP LOCKED (for non-PostgreSQL or if raw query fails)
   */
  private async acquireJobFallback(): Promise<BackgroundJob | null> {
    return await prisma.$transaction(async (tx) => {
      // Find a pending job that's ready to process
      const job = await tx.backgroundJob.findFirst({
        where: {
          status: JobStatus.PENDING,
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: new Date() } },
          ],
        },
        orderBy: { createdAt: "asc" },
      });

      if (!job) return null;

      // Mark it as processing
      return await tx.backgroundJob.update({
        where: { id: job.id },
        data: { 
          status: JobStatus.PROCESSING, 
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
          updatedAt: new Date(),
        },
      });
    });
  }

  /**
   * Release a job back to pending queue (for graceful shutdown or retries)
   */
  async releaseJob(jobId: string, errorMessage?: string): Promise<void> {
    const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const shouldRequeue = job.attempts < job.maxAttempts;
    
    if (shouldRequeue) {
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, job.attempts);
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.PENDING,
          error: errorMessage,
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
    } else {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: `Released. Last error: ${errorMessage}`,
          failedAt: new Date(),
          nextAttemptAt: null,
        },
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const jobWorker = new JobWorker();
