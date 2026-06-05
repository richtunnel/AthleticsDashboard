import { prisma } from "../database/prisma";
import { JobType, JobStatus, Prisma } from "@prisma/client";

export interface EnqueueJobParams {
  type: JobType;
  payload: any;
  userId?: string;
  organizationId?: string;
  maxAttempts?: number;
  nextAttemptAt?: Date;
  idempotencyKey?: string;
}

export interface JobProgress {
  id: string;
  type: JobType;
  status: JobStatus;
  userId?: string | null;
  organizationId?: string | null;
  progress?: {
    current?: number;
    total?: number;
    checkpoint?: string;
    message?: string;
  };
  result?: any;
  error?: string | null;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000; // 1 second base for exponential backoff

export class JobQueueService {
  /**
   * Enqueue a new background job with automatic exponential backoff scheduling
   */
  async enqueue(params: EnqueueJobParams): Promise<{ id: string; status: JobStatus }> {
    const { 
      type, 
      payload, 
      userId, 
      organizationId, 
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt,
      idempotencyKey
    } = params;

    // Check for existing job with same idempotency key to prevent duplicates
    if (idempotencyKey) {
      const existingJob = await prisma.backgroundJob.findFirst({
        where: {
          payload: { path: ["idempotencyKey"], equals: idempotencyKey },
          status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
        },
      });
      
      if (existingJob) {
        return { id: existingJob.id, status: existingJob.status };
      }
    }

    // Calculate initial nextAttemptAt if not provided
    const scheduledAt = nextAttemptAt || new Date();

    return await prisma.backgroundJob.create({
      data: {
        type,
        payload: {
          ...payload,
          idempotencyKey,
          enqueuedAt: new Date().toISOString(),
        },
        userId,
        organizationId,
        maxAttempts,
        status: JobStatus.PENDING,
        nextAttemptAt: scheduledAt,
      },
      select: { id: true, status: true },
    });
  }

  /**
   * Requeue a failed job with exponential backoff
   */
  async requeue(jobId: string, errorMessage?: string): Promise<boolean> {
    const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
    
    if (!job) {
      console.error(`[JobQueueService] Cannot requeue: job ${jobId} not found`);
      return false;
    }

    if (job.attempts >= job.maxAttempts) {
      console.warn(`[JobQueueService] Job ${jobId} has reached max attempts (${job.maxAttempts}), not requeueing`);
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: JobStatus.FAILED,
          error: `Max attempts reached. Last error: ${errorMessage || job.error}`,
          failedAt: new Date(),
        },
      });
      return false;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s...
    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, job.attempts);
    const nextAttemptAt = new Date(Date.now() + backoffMs);

    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PENDING,
        nextAttemptAt,
        lastAttemptAt: new Date(),
        attempts: { increment: 1 },
        error: errorMessage,
      },
    });

    console.log(`[JobQueueService] Requeued job ${jobId} with backoff ${backoffMs}ms (attempt ${job.attempts + 1}/${job.maxAttempts})`);
    return true;
  }

  /**
   * Get job details including progress information
   */
  async getJob(id: string): Promise<JobProgress | null> {
    const job = await prisma.backgroundJob.findUnique({
      where: { id },
    });

    if (!job) return null;

    // Extract progress from payload if available
    const progress = (job.payload as any)?.progress as JobProgress["progress"] | undefined;

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      userId: job.userId,
      organizationId: job.organizationId,
      progress,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    };
  }

  /**
   * Update job status with proper state transitions
   */
  async updateJobStatus(
    id: string, 
    status: JobStatus, 
    data?: { error?: string; result?: any; progress?: any }
  ): Promise<void> {
    const now = new Date();
    
    const updateData: Prisma.BackgroundJobUpdateInput = {
      status,
      ...data,
    };

    if (status === JobStatus.COMPLETED) {
      updateData.completedAt = now;
      updateData.nextAttemptAt = null;
    } else if (status === JobStatus.FAILED) {
      updateData.failedAt = now;
      updateData.nextAttemptAt = null;
    } else if (status === JobStatus.PROCESSING) {
      updateData.lastAttemptAt = now;
    }

    await prisma.backgroundJob.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update job progress (for long-running jobs like imports)
   */
  async updateProgress(id: string, progress: { current?: number; total?: number; checkpoint?: string; message?: string }): Promise<void> {
    await prisma.backgroundJob.update({
      where: { id },
      data: {
        payload: {
          ...await this.getJobPayload(id),
          progress,
        },
      },
    });
  }

  /**
   * Mark job as completed with result
   */
  async complete(id: string, result?: any): Promise<void> {
    await this.updateJobStatus(id, JobStatus.COMPLETED, {
      result: result || {},
    });
  }

  /**
   * Mark job as failed and potentially requeue
   */
  async fail(id: string, error: string, shouldRequeue = true): Promise<boolean> {
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    
    if (!job) return false;

    if (shouldRequeue && job.attempts < job.maxAttempts) {
      return this.requeue(id, error);
    }

    await this.updateJobStatus(id, JobStatus.FAILED, { error });
    return false;
  }

  /**
   * Get pending jobs for processing (used by worker)
   */
  async getPendingJobs(limit: number = 10): Promise<any[]> {
    return await prisma.backgroundJob.findMany({
      where: {
        status: JobStatus.PENDING,
        OR: [
          { nextAttemptAt: null },
          { nextAttemptAt: { lte: new Date() } },
        ],
      },
      orderBy: [
        { nextAttemptAt: "asc" },
        { createdAt: "asc" },
      ],
      take: limit,
    });
  }

  /**
   * Get jobs by organization for status tracking
   */
  async getJobsByOrganization(organizationId: string, options?: {
    type?: JobType;
    status?: JobStatus;
    limit?: number;
    offset?: number;
  }): Promise<JobProgress[]> {
    const { type, status, limit = 50, offset = 0 } = options || {};

    const where: Prisma.BackgroundJobWhereInput = { organizationId };
    if (type) where.type = type;
    if (status) where.status = status;

    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return jobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: (job.payload as any)?.progress,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
    }));
  }

  /**
   * Cancel a pending job
   */
  async cancel(id: string): Promise<boolean> {
    const job = await prisma.backgroundJob.findUnique({ where: { id } });
    
    if (!job) return false;
    if (job.status !== JobStatus.PENDING) return false;

    await prisma.backgroundJob.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        error: "Cancelled by user",
        failedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const result = await prisma.backgroundJob.deleteMany({
      where: {
        status: { in: [JobStatus.COMPLETED, JobStatus.FAILED] },
        updatedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  private async getJobPayload(id: string): Promise<any> {
    const job = await prisma.backgroundJob.findUnique({ where: { id }, select: { payload: true } });
    return job?.payload || {};
  }
}

export const jobQueueService = new JobQueueService();
