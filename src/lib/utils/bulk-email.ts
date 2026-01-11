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
  const BATCH_SIZE = 50;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

  // Process emails in batches
  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const batch = to.slice(i, i + BATCH_SIZE);

    // Add delay between batches (except for first batch)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }

    // Send each email individually using Resend batch API
    const batchPromises = batch.map(async (email) => {
      try {
        // Send email via Resend
        const emailResponse = await resend.emails.send({
          ...emailOptions,
          to: [email], // Send to individual recipient
        });

        // Create individual email log
        const emailLog = await prisma.emailLog.create({
          data: {
            to: [email],
            cc: [],
            subject,
            body: html,
            status: emailResponse.error ? "FAILED" : "SENT",
            error: emailResponse.error?.message || null,
            sentAt: emailResponse.error ? null : new Date(),
            sentById,
            gameIds,
            groupId: groupId || null,
            campaignId: campaignId || null,
            recipientCategory: recipientCategory || null,
            additionalMessage: additionalMessage || null,
          },
        });

        if (emailResponse.error) {
          result.failed++;
          result.errors.push({ email, error: emailResponse.error.message });
        } else {
          result.success++;
          result.emailLogIds.push(emailLog.id);
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        result.errors.push({ email, error: errorMessage });

        // Still create a failed email log
        try {
          const emailLog = await prisma.emailLog.create({
            data: {
              to: [email],
              cc: [],
              subject,
              body: html,
              status: "FAILED",
              error: errorMessage,
              sentAt: null,
              sentById,
              gameIds,
              groupId: groupId || null,
              campaignId: campaignId || null,
              recipientCategory: recipientCategory || null,
              additionalMessage: additionalMessage || null,
            },
          });
          result.emailLogIds.push(emailLog.id);
        } catch (logError) {
          console.error("Failed to create email log:", logError);
        }
      }
    });

    // Wait for batch to complete
    await Promise.all(batchPromises);
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
