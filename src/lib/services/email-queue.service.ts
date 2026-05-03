import { prisma } from "../database/prisma";
import { emailLimitService } from "./email-limit.service";
import { jobQueueService } from "./job-queue.service";
import { JobType } from "@prisma/client";

export interface BulkEmailParams {
  userId: string;
  organizationId: string;
  to: string[];
  subject: string;
  body: string;
  replyTo?: string;
  gameIds?: string[];
  groupId?: string;
  campaignId?: string;
  recipientCategory?: string;
  additionalMessage?: string;
  visibleColumnIds?: string[];
  selectedSchoolNames?: string[];
}

export class EmailQueueService {
  async enqueueBulkEmail(params: BulkEmailParams) {
    const { 
      userId, 
      organizationId, 
      to, 
      subject, 
      body,
      replyTo,
      gameIds,
      groupId,
      campaignId,
      recipientCategory,
      additionalMessage,
      visibleColumnIds,
      selectedSchoolNames
    } = params;

    // 1. Check limits
    const limitCheck = await emailLimitService.checkEmailLimits(userId, to.length);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || "Email limit exceeded");
    }

    // Use the new generic background job queue for each recipient or for the whole batch
    // For now, let's keep the existing EmailJob but also support generic background jobs if needed.
    // Actually, to satisfy the requirement, I'll enqueue it as a generic job.
    
    const job = await jobQueueService.enqueue({
      type: JobType.EMAIL,
      payload: params,
      userId,
      organizationId,
    });

    return job;
  }
}

export const emailQueueService = new EmailQueueService();
