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
  const { 
    to, 
    subject, 
    html, 
    sentById, 
    replyTo, 
    gameIds = [], 
    groupId, 
    campaignId, 
    recipientCategory, 
    additionalMessage, 
    visibleColumnIds = [], 
    selectedSchoolNames = [] 
  } = params;

  console.log(`[EMAIL] Starting bulk email send: ${to.length} recipients, subject: "${subject}"`);

  const resend = getResendClientOptional();
  if (!resend) {
    console.error("[EMAIL] Resend client not configured");
    throw new Error("Email service not configured. Please set RESEND_API_KEY.");
  }

  // Check email limits before sending
  console.log(`[EMAIL] Checking email limits for user ${sentById}`);
  const limitCheck = await emailLimitService.checkEmailLimits(sentById, to.length);
  if (!limitCheck.allowed) {
    console.error(`[EMAIL] Email limit exceeded: ${limitCheck.reason}`);
    throw new Error(limitCheck.reason || "Email limit exceeded");
  }
  console.log(`[EMAIL] Limits OK - Daily: ${limitCheck.dailyUsed}/${limitCheck.dailyLimit}, Monthly: ${limitCheck.monthlyUsed}/${limitCheck.monthlyLimit}`);

  // Get email from environment variable with validation
  const emailFrom = process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>";
  console.log(`[EMAIL] Using FROM address: ${emailFrom}`);

  // Build email options with reply-to if provided
  const emailOptions: any = {
    from: emailFrom,
    to: [], // Will be set per email in batch
    subject,
    html,
  };
  
  if (replyTo) {
    emailOptions.replyTo = replyTo;
    console.log(`[EMAIL] Reply-to address: ${replyTo}`);
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
  const MAX_RETRIES = 2; // Retry failed batches up to 2 times

  console.log(`[EMAIL] Processing ${to.length} emails in batches of ${BATCH_SIZE}`);

  // Process emails in batches
  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const batch = to.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(to.length / BATCH_SIZE);

    console.log(`[EMAIL] Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

    // Add delay between batches (except for first batch)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }

    // Prepare batch for Resend
    const resendBatch = batch.map((email) => ({
      ...emailOptions,
      to: [email],
    }));

    let batchSuccess = false;
    let retryCount = 0;

    // Retry logic for transient failures
    while (!batchSuccess && retryCount <= MAX_RETRIES) {
      try {
        if (retryCount > 0) {
          console.log(`[EMAIL] Retry ${retryCount}/${MAX_RETRIES} for batch ${batchNumber}`);
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }

        // Send batch via Resend
        console.log(`[EMAIL] Calling Resend API for batch ${batchNumber}`);
        const { data: batchResponses, error: batchError } = await resend.batch.send(resendBatch);

        if (batchError) {
          console.error(`[EMAIL] Resend batch API error (batch ${batchNumber}):`, batchError);
          throw batchError;
        }

        // Validate response
        if (!batchResponses || !Array.isArray(batchResponses) || batchResponses.length === 0) {
          console.error(`[EMAIL] Invalid Resend API response for batch ${batchNumber}:`, batchResponses);
          throw new Error("Empty or invalid response from email service");
        }

        console.log(`[EMAIL] Received ${batchResponses.length} responses for batch ${batchNumber}`);

        // Process results and create email logs
        const logData = batch.map((email, index) => {
          const response = batchResponses[index];
          const responseId = response ? (response.id || response.data?.id) : null;

          // Handle different error response formats from Resend
          let hasError = false;
          let errorMessage: string | null = null;

          if (!response) {
            hasError = true;
            errorMessage = "No response from email service";
            console.warn(`[EMAIL] No response for ${email}`);
          } else if (response.error) {
            hasError = true;
            // Resend errors can have different structures
            errorMessage = typeof response.error === 'string'
              ? response.error
              : (response.error.message || response.error.description || JSON.stringify(response.error));
            console.warn(`[EMAIL] Error sending to ${email}: ${errorMessage}`);
          } else if (!responseId) {
            // Check if we have a valid email ID in the response
            hasError = true;
            errorMessage = "Invalid response format from email service (missing email ID)";
            console.warn(`[EMAIL] Missing email ID for ${email}`);
          } else {
            console.log(`[EMAIL] Successfully sent to ${email}, ID: ${responseId}`);
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
        console.log(`[EMAIL] Creating ${logData.length} email logs in database`);
        let createdLogs: any[] = [];
        try {
          createdLogs = await (prisma.emailLog as any).createManyAndReturn({
            data: logData,
          });
          console.log(`[EMAIL] Successfully created ${createdLogs.length} email logs using batch operation`);
        } catch (batchError) {
          console.warn("[EMAIL] Batch createManyAndReturn failed, falling back to individual creates:", batchError);
          // Fallback: create logs individually
          for (const log of logData) {
            try {
              const createdLog = await prisma.emailLog.create({
                data: log,
              });
              createdLogs.push(createdLog);
            } catch (createError) {
              console.error("[EMAIL] Failed to create individual email log:", createError);
              // Continue with other logs even if one fails
            }
          }
          console.log(`[EMAIL] Created ${createdLogs.length} email logs using individual operations`);
        }

        // Update results
        batch.forEach((email, index) => {
          const response = batchResponses[index];
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

        batchSuccess = true;
        console.log(`[EMAIL] Batch ${batchNumber} completed: ${result.success} success, ${result.failed} failed`);

      } catch (error) {
        retryCount++;
        
        // Extract error message
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

        console.error(`[EMAIL] Batch ${batchNumber} attempt ${retryCount} failed:`, errorMessage);

        // If we've exhausted retries, handle the failure
        if (retryCount > MAX_RETRIES) {
          console.error(`[EMAIL] Batch ${batchNumber} failed after ${MAX_RETRIES} retries`);

          // Create failed email logs
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
              console.warn("[EMAIL] Batch createManyAndReturn failed for error logs, falling back to individual creates:", batchError);
              // Fallback: create logs individually
              for (const log of logData) {
                try {
                  const createdLog = await prisma.emailLog.create({
                    data: log,
                  });
                  createdLogs.push(createdLog);
                } catch (createError) {
                  console.error("[EMAIL] Failed to create individual error email log:", createError);
                  // Continue with other logs even if one fails
                }
              }
            }

            // Only add IDs if we successfully created logs
            if (createdLogs && createdLogs.length > 0) {
              result.emailLogIds.push(...createdLogs.map((log: any) => log.id));
            }
          } catch (logError) {
            console.error("[EMAIL] Failed to create failed email logs:", logError);
          }

          batch.forEach((email) => {
            result.failed++;
            result.errors.push({ email, error: errorMessage });
          });

          break; // Exit retry loop
        }
      }
    }
  }

  console.log(`[EMAIL] Bulk email send complete - Total: ${to.length}, Success: ${result.success}, Failed: ${result.failed}`);
  if (result.errors.length > 0) {
    console.error(`[EMAIL] Errors encountered:`, result.errors.slice(0, 5)); // Log first 5 errors
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
  // More comprehensive email regex that handles edge cases
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const valid: string[] = [];
  const invalid: string[] = [];

  emails.forEach((email) => {
    const trimmed = email.trim().toLowerCase();
    if (emailRegex.test(trimmed) && trimmed.length <= 254) {
      valid.push(trimmed);
    } else if (trimmed) {
      invalid.push(trimmed);
    }
  });

  return { valid, invalid };
}
