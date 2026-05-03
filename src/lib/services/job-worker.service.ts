import { prisma } from "../database/prisma";
import { JobType, JobStatus, BackgroundJob } from "@prisma/client";
import { emailGatewayService } from "./email-gateway.service";
import { calendarService } from "./calendar.service";
import { importExportService } from "./import-export.service";
import { stripeWebhookService } from "./stripe-webhook.service";

export type JobHandler = (payload: any, job: BackgroundJob) => Promise<any>;

export class JobWorker {
  private handlers: Partial<Record<JobType, JobHandler>> = {
    [JobType.EMAIL]: async (payload) => {
      return await emailGatewayService.send(payload);
    },
    [JobType.STRIPE_WEBHOOK]: async (payload) => {
      return await stripeWebhookService.processWebhookEvent(payload);
    },
    [JobType.CALENDAR_SYNC]: async (payload) => {
      return await calendarService.syncAllGames(payload.userId, payload.organizationId);
    },
    [JobType.GAME_IMPORT]: async (payload) => {
      return await importExportService.processImportJob(payload);
    },
  };

  async processNextJob(): Promise<boolean> {
    const job = await this.acquireJob();
    if (!job) return false;

    console.log(`[JobWorker] Processing job ${job.id} of type ${job.type}`);

    try {
      const handler = this.handlers[job.type];
      if (!handler) {
        throw new Error(`No handler for job type: ${job.type}`);
      }

      const result = await handler(job.payload, job);
      
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          result: result || {},
          completedAt: new Date(),
        },
      });
      
      console.log(`[JobWorker] Job ${job.id} completed successfully`);
    } catch (error: any) {
      console.error(`[JobWorker] Error processing job ${job.id}:`, error);
      
      const attempts = job.attempts + 1;
      const shouldRetry = attempts < job.maxAttempts;
      
      const nextAttemptAt = shouldRetry 
        ? new Date(Date.now() + Math.pow(2, attempts) * 1000) // Exponential backoff: 2s, 4s, 8s, 16s, 32s...
        : null;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? JobStatus.PENDING : JobStatus.FAILED,
          error: error.message || String(error),
          attempts,
          nextAttemptAt,
          failedAt: shouldRetry ? null : new Date(),
        },
      });
    }

    return true;
  }

  private async acquireJob(): Promise<BackgroundJob | null> {
    // Use SKIP LOCKED for concurrency if supported by DB
    try {
      // Prisma doesn't support UPDATE ... RETURNING with SKIP LOCKED in queryRaw easily for all dialects
      // but for Postgres it works.
      const jobs = await prisma.$queryRawUnsafe(`
        UPDATE "BackgroundJob"
        SET "status" = 'PROCESSING', "lastAttemptAt" = NOW(), "updatedAt" = NOW()
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
      `) as BackgroundJob[];

      return jobs[0] || null;
    } catch (error) {
      console.error("[JobWorker] Error acquiring job with SKIP LOCKED, falling back:", error);
      // Fallback if queryRaw fails
      return await prisma.$transaction(async (tx) => {
        const job = await tx.backgroundJob.findFirst({
          where: {
            status: JobStatus.PENDING,
            nextAttemptAt: { lte: new Date() },
          },
          orderBy: { createdAt: "asc" },
        });

        if (!job) return null;

        return await tx.backgroundJob.update({
          where: { id: job.id },
          data: { 
            status: JobStatus.PROCESSING, 
            lastAttemptAt: new Date(),
            updatedAt: new Date()
          },
        });
      });
    }
  }
}

export const jobWorker = new JobWorker();
