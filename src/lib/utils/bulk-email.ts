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
  visibleColumnIds?: string[];
  selectedSchoolNames?: string[];
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
  const { to, subject, html, sentById, replyTo, gameIds = [], groupId, campaignId, recipientCategory, additionalMessage, visibleColumnIds = [], selectedSchoolNames = [] } = params;

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
    from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
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
        console.error("Resend batch API error:", batchError);
        throw batchError;
      }

      // Log full response for debugging
      if (!batchResponses || batchResponses.length === 0) {
        console.error("Resend batch API returned empty response");
        throw new Error("Empty response from email service");
      }

      // Process results and create email logs
      const logData = batch.map((email, index) => {
        const response = batchResponses ? batchResponses[index] : null;
        const responseId = response ? (response.id || response.data?.id) : null;

        // Handle different error response formats from Resend
        let hasError = false;
        let errorMessage: string | null = null;

        if (!response) {
          hasError = true;
          errorMessage = "No response from email service";
        } else if (response.error) {
          hasError = true;
          // Resend errors can have different structures
          errorMessage = typeof response.error === 'string'
            ? response.error
            : (response.error.message || response.error.description || JSON.stringify(response.error));
        } else if (!responseId) {
          // Check if we have a valid email ID in the response
          hasError = true;
          errorMessage = "Invalid response format from email service (missing email ID)";
        }

        return {
          to: [email],
          cc: [],
          subject,
          body: html,
          status: (hasError ? "FAILED" : "SENT") as any,
          error: errorMessage,
          sentAt: hasError ? null : new Date(),
          sentById,
          gameIds,
          groupId: groupId || null,
          campaignId: campaignId || null,
          recipientCategory: recipientCategory || null,
          additionalMessage: additionalMessage || null,
          visibleColumnIds,
          selectedSchoolNames,
        };
      });

      // Try to use createManyAndReturn to get IDs of created logs
      // Fallback to individual creates if batch operation fails
      let createdLogs: any[] = [];
      try {
        createdLogs = await (prisma.emailLog as any).createManyAndReturn({
          data: logData,
        });
      } catch (batchError) {
        console.warn("createManyAndReturn failed, falling back to individual creates:", batchError);
        // Fallback: create logs individually
        for (const log of logData) {
          try {
            const createdLog = await prisma.emailLog.create({
              data: log,
            });
            createdLogs.push(createdLog);
          } catch (createError) {
            console.error("Failed to create individual email log:", createError);
            // Continue with other logs even if one fails
          }
        }
      }

      // Update results
      batch.forEach((email, index) => {
        const response = batchResponses ? batchResponses[index] : null;
        const responseId = response ? (response.id || response.data?.id) : null;

        if (!response) {
          result.failed++;
          result.errors.push({ email, error: "No response from email service" });
        } else if (response.error) {
          result.failed++;
          // Extract error message with better handling
          const errorMsg = typeof response.error === 'string'
            ? response.error
            : (response.error.message || response.error.description || JSON.stringify(response.error));
          result.errors.push({ email, error: errorMsg });
        } else if (!responseId) {
          result.failed++;
          result.errors.push({ email, error: "Invalid response format from email service (missing email ID)" });
        } else {
          result.success++;
        }
      });

      // Only add IDs if we successfully created logs
      if (createdLogs && createdLogs.length > 0) {
        result.emailLogIds.push(...createdLogs.map((log: any) => log.id));
      }

    } catch (error) {
      // Handle whole batch failure
      let errorMessage: string;

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle Resend API error objects
        const errObj = error as any;
        errorMessage = errObj.message || errObj.description || JSON.stringify(error);
      } else {
        errorMessage = "Unknown batch error";
      }

      console.error(`Batch email send failed for ${batch.length} emails:`, error);

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
        visibleColumnIds,
        selectedSchoolNames,
      }));

      try {
        // Try batch insert first, fall back to individual creates
        let createdLogs: any[] = [];
        try {
          createdLogs = await (prisma.emailLog as any).createManyAndReturn({
            data: logData,
          });
        } catch (batchError) {
          console.warn("createManyAndReturn failed for error logs, falling back to individual creates:", batchError);
          // Fallback: create logs individually
          for (const log of logData) {
            try {
              const createdLog = await prisma.emailLog.create({
                data: log,
              });
              createdLogs.push(createdLog);
            } catch (createError) {
              console.error("Failed to create individual error email log:", createError);
              // Continue with other logs even if one fails
            }
          }
        }

        // Only add IDs if we successfully created logs
        if (createdLogs && createdLogs.length > 0) {
          result.emailLogIds.push(...createdLogs.map((log: any) => log.id));
        }
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
