import { prisma } from "../database/prisma";
import { jobQueueService } from "./job-queue.service";
import { getEmailContactLimit } from "../security/plan-limits";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_SIZE = 500;

export interface EmailImportJobPayload {
  groupId: string;
  userId: string;
  organizationId: string;
  emails: string[];
  jobId?: string;
}

export class EmailImportService {
  /**
   * Normalize and validate email addresses
   */
  normalizeEmails(raw: string[]): string[] {
    const seen = new Set<string>();
    for (const item of raw) {
      if (typeof item !== "string") continue;
      // Handle comma-separated emails within a single string
      const parts = item.includes(",") ? item.split(",") : [item];
      for (const part of parts) {
        const email = part.trim().toLowerCase();
        if (email && EMAIL_REGEX.test(email)) {
          seen.add(email);
        }
      }
    }
    return Array.from(seen);
  }

  /**
   * Process the email import, either synchronously or as part of a background job
   */
  async processImportJob(payload: EmailImportJobPayload) {
    const { groupId, userId, organizationId, emails, jobId } = payload;
    
    const normalized = this.normalizeEmails(emails);
    
    // 1. Check plan limits
    const [contactLimit, currentContactCount] = await Promise.all([
      getEmailContactLimit(userId),
      prisma.emailAddress.count({
        where: {
          group: { organizationId },
        },
      }),
    ]);

    const isLimitFinite = isFinite(contactLimit);
    const available = isLimitFinite ? Math.max(0, contactLimit - currentContactCount) : Infinity;

    if (isLimitFinite && currentContactCount >= contactLimit) {
      const errorMsg = `You have reached your plan's email contact limit of ${contactLimit.toLocaleString()} contacts.`;
      if (jobId) {
        await jobQueueService.fail(jobId, errorMsg, false);
      }
      throw new Error(errorMsg);
    }

    // Clamp the import to what's available
    const toImport = isLimitFinite ? normalized.slice(0, available) : normalized;
    const clampedCount = normalized.length - toImport.length;
    const totalToProcess = toImport.length;
    
    let addedCount = 0;
    let duplicateCount = 0;

    console.log(`[EmailImportService] Starting import of ${totalToProcess} emails for group ${groupId}`);

    // 2. Process in batches to avoid large transaction issues and provide progress updates
    for (let i = 0; i < totalToProcess; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);
      
      if (jobId) {
        await jobQueueService.updateProgress(jobId, {
          current: i,
          total: totalToProcess,
          message: `Importing emails... (${i}/${totalToProcess})`,
        });
      }

      // Check existing emails in this group to avoid unique constraint violations
      // and provide better feedback on duplicates
      const existing = await prisma.emailAddress.findMany({
        where: { 
          groupId, 
          email: { in: batch } 
        },
        select: { email: true },
      });
      
      const existingSet = new Set(existing.map((e) => e.email));
      const newEmails = batch.filter((e) => !existingSet.has(e));

      if (newEmails.length > 0) {
        const result = await prisma.emailAddress.createMany({
          data: newEmails.map((email) => ({ email, groupId })),
          skipDuplicates: true,
        });
        addedCount += result.count;
      }
      
      duplicateCount += (batch.length - newEmails.length);
    }

    const result = {
      added: addedCount,
      duplicates: duplicateCount,
      clamped: clampedCount,
      totalProcessed: totalToProcess,
      limitReached: isLimitFinite && (currentContactCount + addedCount >= contactLimit)
    };

    if (jobId) {
      await jobQueueService.complete(jobId, result);
    }

    console.log(`[EmailImportService] Import completed:`, result);
    return result;
  }
}

export const emailImportService = new EmailImportService();
