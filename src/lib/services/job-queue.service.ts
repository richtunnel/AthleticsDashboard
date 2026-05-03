import { prisma } from "../database/prisma";
import { JobType, JobStatus } from "@prisma/client";

export class JobQueueService {
  async enqueue(params: {
    type: JobType;
    payload: any;
    userId?: string;
    organizationId?: string;
    maxAttempts?: number;
    nextAttemptAt?: Date;
  }) {
    const { 
      type, 
      payload, 
      userId, 
      organizationId, 
      maxAttempts = 5,
      nextAttemptAt = new Date()
    } = params;

    return await prisma.backgroundJob.create({
      data: {
        type,
        payload,
        userId,
        organizationId,
        maxAttempts,
        status: JobStatus.PENDING,
        nextAttemptAt,
      },
    });
  }

  async getJob(id: string) {
    return await prisma.backgroundJob.findUnique({
      where: { id },
    });
  }

  async updateJobStatus(id: string, status: JobStatus, data?: { error?: string; result?: any }) {
    return await prisma.backgroundJob.update({
      where: { id },
      data: {
        status,
        ...data,
        ...(status === JobStatus.COMPLETED ? { completedAt: new Date() } : {}),
        ...(status === JobStatus.FAILED ? { failedAt: new Date() } : {}),
      },
    });
  }
}

export const jobQueueService = new JobQueueService();
