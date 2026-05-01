import { prisma } from "../database/prisma";
import { emailLimitService } from "./email-limit.service";

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

    // 2. Create Job and Recipients in a transaction
    const job = await prisma.$transaction(async (tx) => {
      const newJob = await tx.emailJob.create({
        data: {
          userId,
          organizationId,
          subject,
          body,
          replyTo: replyTo || null,
          totalCount: to.length,
          status: "PENDING",
          gameIds: gameIds || [],
          groupId: groupId || null,
          campaignId: campaignId || null,
          recipientCategory: recipientCategory || null,
          additionalMessage: additionalMessage || null,
          visibleColumnIds: visibleColumnIds || [],
          selectedSchoolNames: selectedSchoolNames || [],
        },
      });

      // Split recipients into chunks of 1000 for createMany if needed
      // But for now, just create them
      await tx.emailRecipient.createMany({
        data: to.map((email) => ({
          jobId: newJob.id,
          email,
          status: "PENDING",
        })),
      });

      return newJob;
    });

    return job;
  }
}

export const emailQueueService = new EmailQueueService();
