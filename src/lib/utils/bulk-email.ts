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
  customRecipients?: string[];
}

interface EmailLogData {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  status: "SENT" | "FAILED";
  error: string | null;
  sentAt: Date | null;
  sentById: string;
  gameIds: string[];
  groupId: string | null;
  campaignId: string | null;
  recipientCategory: string | null;
  additionalMessage: string | null;
  visibleColumnIds: string[];
  selectedSchoolNames: string[];
  customRecipients: string[];
}

interface BatchEmailResponse {
  email: string;
  success: boolean;
  error: string | null;
}

interface ResendBatchResponse {
  id?: string;
  data?: { id?: string };
  error?: string | { message?: string; description?: string };
}

// Constants
const CONFIG = {
  BATCH_SIZE: 100,
  DELAY_BETWEEN_BATCHES_MS: 200,
  MAX_RETRIES: 2,
  RETRY_BACKOFF_BASE: 2000, // 2 seconds base for exponential backoff
  EMAIL_FROM: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
} as const;

// Email validation regex - RFC 5322 simplified version
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Validates email addresses in bulk
 */
export function validateBulkEmails(emails: string[]): {
  valid: string[];
  invalid: string[];
} {
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    const trimmed = email.trim().toLowerCase();

    if (trimmed.length === 0) continue;

    if (EMAIL_REGEX.test(trimmed) && trimmed.length <= MAX_EMAIL_LENGTH) {
      valid.push(trimmed);
    } else {
      invalid.push(email); // Return original for user feedback
    }
  }

  return { valid, invalid };
}

/**
 * Extract error message from various error formats
 */
function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    return (errObj.message || errObj.description || JSON.stringify(error)) as string;
  }

  return "Unknown error";
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(retryCount: number): number {
  return CONFIG.RETRY_BACKOFF_BASE * Math.pow(CONFIG.RETRY_BACKOFF_BASE / 1000, retryCount);
}

/**
 * Build email log data from batch results
 */
function buildEmailLogData(email: string, params: SendBulkEmailParams, status: "SENT" | "FAILED", error: string | null): EmailLogData {
  return {
    to: [email],
    cc: [],
    subject: params.subject,
    body: params.html,
    status,
    error,
    sentAt: status === "SENT" ? new Date() : null,
    sentById: params.sentById,
    gameIds: params.gameIds || [],
    groupId: params.groupId || null,
    campaignId: params.campaignId || null,
    recipientCategory: params.recipientCategory || null,
    additionalMessage: params.additionalMessage || null,
    visibleColumnIds: params.visibleColumnIds || [],
    selectedSchoolNames: params.selectedSchoolNames || [],
    customRecipients: params.customRecipients || [],
  };
}

/**
 * Create email logs in database with fallback to individual creates
 */
async function createEmailLogs(logs: EmailLogData[]): Promise<string[]> {
  const ids: string[] = [];

  try {
    // Try batch insert first
    const createdLogs = await (prisma.emailLog as any).createManyAndReturn({
      data: logs,
    });

    console.log(`[EMAIL] Created ${createdLogs.length} email logs using batch operation`);
    return createdLogs.map((log: any) => log.id);
  } catch (batchError) {
    console.warn("[EMAIL] Batch createManyAndReturn failed, falling back to individual creates:", batchError);

    // Fallback: create logs individually
    for (const log of logs) {
      try {
        const createdLog = await prisma.emailLog.create({ data: log });
        ids.push(createdLog.id);
      } catch (createError) {
        console.error("[EMAIL] Failed to create individual email log:", createError);
        // Continue with other logs
      }
    }

    console.log(`[EMAIL] Created ${ids.length} email logs using individual operations`);
    return ids;
  }
}

/**
 * Safely extract email ID from response (handles various Resend API response formats)
 */
function extractEmailId(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;

  const r = response as Record<string, unknown>;
  return (r.id as string) || ((r.data as any)?.id as string) || null;
}

/**
 * Check if response indicates an error
 */
function hasResponseError(response: unknown): boolean {
  if (!response || typeof response !== "object") return true;

  const r = response as Record<string, unknown>;
  return !!(r.error || (!r.id && !(r.data as any)?.id));
}

/**
 * Process a single batch of emails via Resend API with robust error handling
 */
async function processBatch(batch: string[], params: SendBulkEmailParams, batchNumber: number, totalBatches: number): Promise<BatchEmailResponse[]> {
  const resend = getResendClientOptional();
  if (!resend) {
    throw new Error("Email service not configured. Please set RESEND_API_KEY.");
  }

  const emailOptions = {
    from: CONFIG.EMAIL_FROM,
    subject: params.subject,
    html: params.html,
    ...(params.replyTo && { replyTo: params.replyTo }),
  };

  // Prepare batch for Resend API
  const resendBatch = batch.map((email) => ({
    ...emailOptions,
    to: [email],
  }));

  console.log(`[EMAIL] Calling Resend API for batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);

  let batchResponses: unknown;
  let batchError: unknown;

  try {
    const result = await resend.batch.send(resendBatch);
    batchResponses = result.data;
    batchError = result.error;
  } catch (e) {
    console.error(`[EMAIL] Resend API threw exception for batch ${batchNumber}:`, e);
    throw e;
  }

  if (batchError) {
    console.error(`[EMAIL] Resend batch API error (batch ${batchNumber}):`, batchError);
    throw batchError;
  }

  // Normalize response format (Resend API can return different structures)
  let normalizedResponses: unknown[] | null = null;

  if (Array.isArray(batchResponses)) {
    normalizedResponses = batchResponses;
  } else if (batchResponses && typeof batchResponses === "object") {
    const br = batchResponses as Record<string, unknown>;
    if (Array.isArray(br.data)) {
      normalizedResponses = br.data;
    } else if (Array.isArray((br.data as any)?.data)) {
      normalizedResponses = (br.data as any).data;
    }
  }

  if (!normalizedResponses || normalizedResponses.length === 0) {
    console.warn(`[EMAIL] Resend returned empty response for batch ${batchNumber}. Treating as sent.`);
    // If Resend doesn't give us a response, assume success (they likely sent it)
    return batch.map((email) => ({
      email,
      success: true,
      error: null,
    }));
  }

  // Process individual responses
  return batch.map((email, index) => {
    const response = normalizedResponses![index];

    // If no response at this index, assume sent
    if (!response) {
      console.warn(`[EMAIL] No response for email index ${index} (${email}) in batch ${batchNumber}. Assuming sent.`);
      return {
        email,
        success: true,
        error: null,
      };
    }

    // Check for error in response
    if (hasResponseError(response)) {
      const errObj = response as any;
      const errorMsg = typeof errObj.error === "string" ? errObj.error : errObj.error?.message || errObj.error?.description || "Email service error";

      return {
        email,
        success: false,
        error: errorMsg,
      };
    }

    // Check for valid email ID
    const emailId = extractEmailId(response);
    if (!emailId) {
      console.warn(`[EMAIL] No email ID for ${email} in batch ${batchNumber}. Assuming sent.`);
      return {
        email,
        success: true,
        error: null,
      };
    }

    return {
      email,
      success: true,
      error: null,
    };
  });
}

/**
 * Send bulk emails using Resend batch API with proper error handling and tracking.
 *
 * Features:
 * - Rate limit compliance (respects Resend's 75 emails/day per user)
 * - Batch processing with exponential backoff retries
 * - Individual email tracking via database logs
 * - Detailed error reporting
 * - Robust error handling for various API response formats
 *
 * @param params - Bulk email parameters
 * @returns Result with success/failure counts and email log IDs
 * @throws Error if email service is not configured or limits exceeded
 */
export async function sendBulkEmail(params: SendBulkEmailParams): Promise<BulkEmailResult> {
  const { to, subject, sentById } = params;

  // Validate input
  if (!Array.isArray(to) || to.length === 0) {
    throw new Error("No recipients specified");
  }

  if (!subject?.trim()) {
    throw new Error("Subject is required");
  }

  if (!params.html?.trim()) {
    throw new Error("Email HTML content is required");
  }

  console.log(`[EMAIL] Starting bulk email send: ${to.length} recipients, subject: "${subject}"`);

  // Validate email service is configured
  const resend = getResendClientOptional();
  if (!resend) {
    throw new Error("Email service not configured. Please set RESEND_API_KEY.");
  }

  // Check email limits before sending
  console.log(`[EMAIL] Checking email limits for user ${sentById}`);
  const limitCheck = await emailLimitService.checkEmailLimits(sentById, to.length);
  if (!limitCheck.allowed) {
    const error = limitCheck.reason || "Email limit exceeded";
    console.error(`[EMAIL] ${error}`);
    throw new Error(error);
  }

  console.log(`[EMAIL] Limits OK - Daily: ${limitCheck.dailyUsed}/${limitCheck.dailyLimit}, ` + `Monthly: ${limitCheck.monthlyUsed}/${limitCheck.monthlyLimit}`);

  const result: BulkEmailResult = {
    success: 0,
    failed: 0,
    errors: [],
    emailLogIds: [],
  };

  const totalBatches = Math.ceil(to.length / CONFIG.BATCH_SIZE);

  // Process emails in batches
  for (let i = 0; i < to.length; i += CONFIG.BATCH_SIZE) {
    const batch = to.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNumber = Math.floor(i / CONFIG.BATCH_SIZE) + 1;

    // Add delay between batches (except first)
    if (i > 0) {
      await delay(CONFIG.DELAY_BETWEEN_BATCHES_MS);
    }

    let batchSuccess = false;
    let retryCount = 0;

    // Retry logic with exponential backoff
    while (!batchSuccess && retryCount <= CONFIG.MAX_RETRIES) {
      try {
        if (retryCount > 0) {
          const backoffMs = getBackoffDelay(retryCount);
          console.log(`[EMAIL] Retry ${retryCount}/${CONFIG.MAX_RETRIES} for batch ${batchNumber} (backoff: ${backoffMs}ms)`);
          await delay(backoffMs);
        }

        // Process batch and get results
        const batchResults = await processBatch(batch, params, batchNumber, totalBatches);

        // Create email logs
        const emailLogs = batchResults.map((result) => buildEmailLogData(result.email, params, result.success ? "SENT" : "FAILED", result.error));

        const logIds = await createEmailLogs(emailLogs);
        result.emailLogIds.push(...logIds);

        // Update result counts
        for (const batchResult of batchResults) {
          if (batchResult.success) {
            result.success++;
            console.log(`[EMAIL] Successfully sent to ${batchResult.email}`);
          } else {
            result.failed++;
            result.errors.push({
              email: batchResult.email,
              error: batchResult.error || "Unknown error",
            });
            console.warn(`[EMAIL] Failed to send to ${batchResult.email}: ${batchResult.error}`);
          }
        }

        batchSuccess = true;
        console.log(
          `[EMAIL] Batch ${batchNumber}/${totalBatches} completed: ` + `${batchResults.filter((r) => r.success).length} success, ` + `${batchResults.filter((r) => !r.success).length} failed`,
        );
      } catch (error) {
        retryCount++;
        const errorMessage = extractErrorMessage(error);

        console.error(`[EMAIL] Batch ${batchNumber} attempt ${retryCount} failed: ${errorMessage}`);

        // If retries exhausted, mark batch as failed and create error logs
        if (retryCount > CONFIG.MAX_RETRIES) {
          console.error(`[EMAIL] Batch ${batchNumber} failed after ${CONFIG.MAX_RETRIES} retries. ` + `Marking all ${batch.length} emails as failed.`);

          const failedLogs = batch.map((email) => buildEmailLogData(email, params, "FAILED", errorMessage));

          const logIds = await createEmailLogs(failedLogs);
          result.emailLogIds.push(...logIds);

          batch.forEach((email) => {
            result.failed++;
            result.errors.push({ email, error: errorMessage });
          });

          break; // Exit retry loop
        }
      }
    }
  }

  // Log final summary
  console.log(`[EMAIL] Bulk email send complete - Total: ${to.length}, ` + `Success: ${result.success}, Failed: ${result.failed}`);

  if (result.errors.length > 0) {
    console.error(`[EMAIL] First 5 errors:`, result.errors.slice(0, 5));
  }

  return result;
}
