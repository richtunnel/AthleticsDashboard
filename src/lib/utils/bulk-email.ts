import { getResendClientOptional } from "../resend";
import { prisma } from "../database/prisma";
import { emailLimitService } from "../services/email-limit.service";

interface BulkEmailResult {
  success: number;
  failed: number;
  errors: Array<{ email: string; error: string }>;
  emailLogIds: string[];
}

interface SendBulkEmailParams {
  to: string[];
  subject: string;
  html: string;
  sentById: string;
  replyTo?: string;
  gameIds?: string[];
  groupId?: string;
  campaignId?: string;
  recipientCategory?: string;
  additionalMessage?: string;
}

/**
 * Send bulk emails using Resend batch API with proper error handling and individual tracking.
 * This prevents email addresses from being exposed to each other and provides detailed tracking.
 *
 * Resend batch API sends individual emails to each recipient.
 * Rate limits:
 * - Per user: 75 emails/day
 * - System-wide: 100,000 emails/month
 *
 * @param params - Bulk email parameters
 * @returns Result with success/failure counts and email log IDs
 */
export async function sendBulkEmail(params: SendBulkEmailParams): Promise<BulkEmailResult> {
  const { to, subject, html, sentById, replyTo, gameIds = [], groupId, campaignId, recipientCategory, additionalMessage } = params;

  const resend = getResendClientOptional();
  if (!resend) {
    throw new Error("Email service not configured. Please set RESEND_API_KEY.");
  }

  // Check email limits before sending
  const limitCheck = await emailLimitService.checkEmailLimits(sentById, to.length);
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason || "Email limit exceeded");
  }

  // Build email options with reply-to if provided
  const emailOptions: any = {
    from: "Opletics <noreply@opletics.com>",
    to: [], // Will be set per email in batch
    subject,
    html,
  };
  
  if (replyTo) {
    emailOptions.replyTo = replyTo;
  }

  const result: BulkEmailResult = {
    success: 0,
    failed: 0,
    errors: [],
    emailLogIds: [],
  };

  // Batch size to prevent rate limit issues
  const BATCH_SIZE = 100; // Resend batch API limit is 100
  const DELAY_BETWEEN_BATCHES = 200; // 200ms delay between batches (Resend allows 10 requests/sec)

  // Process emails in batches
  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const batch = to.slice(i, i + BATCH_SIZE);

    // Add delay between batches (except for first batch)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }

    // Prepare batch for Resend
    const resendBatch = batch.map((email) => ({
      ...emailOptions,
      to: [email],
    }));

    try {
      // Send batch via Resend
      const { data: batchResponses, error: batchError } = await resend.batch.send(resendBatch);

      if (batchError) {
        throw batchError;
      }

      // Process results and create email logs
      const logData = batch.map((email, index) => {
        const response = batchResponses ? batchResponses[index] : null;
        const hasError = !response || !!response.error;
        const errorMessage = response?.error?.message || "Unknown error during batch send";

        return {
          to: [email],
          cc: [],
          subject,
          body: html,
          status: (hasError ? "FAILED" : "SENT") as any,
          error: hasError ? errorMessage : null,
          sentAt: hasError ? null : new Date(),
          sentById,
          gameIds,
          groupId: groupId || null,
          campaignId: campaignId || null,
          recipientCategory: recipientCategory || null,
          additionalMessage: additionalMessage || null,
        };
      });

      // Use createManyAndReturn to get IDs of created logs
      // Note: We cast to any because of potential Prisma version differences in types
      const createdLogs = await (prisma.emailLog as any).createManyAndReturn({
        data: logData,
      });

      // Update results
      batch.forEach((email, index) => {
        const response = batchResponses ? batchResponses[index] : null;
        if (!response || response.error) {
          result.failed++;
          result.errors.push({ email, error: response?.error?.message || "Unknown error" });
        } else {
          result.success++;
        }
      });
      result.emailLogIds.push(...createdLogs.map((log: any) => log.id));

    } catch (error) {
      // Handle whole batch failure
      const errorMessage = error instanceof Error ? error.message : "Unknown batch error";
      
      const logData = batch.map((email) => ({
        to: [email],
        cc: [],
        subject,
        body: html,
        status: "FAILED" as any,
        error: errorMessage,
        sentAt: null,
        sentById,
        gameIds,
        groupId: groupId || null,
        campaignId: campaignId || null,
        recipientCategory: recipientCategory || null,
        additionalMessage: additionalMessage || null,
      }));

      try {
        const createdLogs = await (prisma.emailLog as any).createManyAndReturn({
          data: logData,
        });
        result.emailLogIds.push(...createdLogs.map((log: any) => log.id));
      } catch (logError) {
        console.error("Failed to create failed email logs:", logError);
      }

      batch.forEach((email) => {
        result.failed++;
        result.errors.push({ email, error: errorMessage });
      });
    }

  }

  return result;
}

/**
 * Validates email addresses in bulk
 * @param emails - Array of email addresses to validate
 * @returns Object with valid and invalid emails
 */
export function validateBulkEmails(emails: string[]): {
  valid: string[];
  invalid: string[];
} {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  emails.forEach((email) => {
    const trimmed = email.trim();
    if (emailRegex.test(trimmed)) {
      valid.push(trimmed);
    } else if (trimmed) {
      invalid.push(trimmed);
    }
  });

  return { valid, invalid };
}
