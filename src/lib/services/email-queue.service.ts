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
  idempotencyKey?: string;
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
      selectedSchoolNames,
      idempotencyKey,
    } = params;

    // 1. Check limits
    const limitCheck = await emailLimitService.checkEmailLimits(userId, to.length);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || "Email limit exceeded");
    }

    // Use the enhanced job queue with idempotency support
    const job = await jobQueueService.enqueue({
      type: JobType.EMAIL,
      payload: {
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
        selectedSchoolNames,
        enqueuedAt: new Date().toISOString(),
      },
      userId,
      organizationId,
      maxAttempts: 3,
      idempotencyKey: idempotencyKey || `email_${userId}_${Date.now()}`,
    });

    return job;
  }
}

export const emailQueueService = new EmailQueueService();
