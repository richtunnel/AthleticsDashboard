import { prisma } from "../database/prisma";
import { BackgroundJob } from "@prisma/client";
import { jobQueueService } from "./job-queue.service";

/** Max emails per DB batch — keeps individual INSERT statements bounded */
const CHUNK_SIZE = 200;
/** Base backoff for per-chunk retries (ms) */
const CHUNK_BASE_BACKOFF_MS = 500;
/** Max retries per chunk before the whole job fails */
const CHUNK_MAX_RETRIES = 3;
/** Backpressure pause between chunks to avoid DB saturation */
const INTER_CHUNK_DELAY_MS = 50;

export interface EmailImportPayload {
  groupId: string;
  userId: string;
  organizationId: string;
  emails: string[];
  /** ISO string — used to prevent replaying old payloads */
  enqueuedAt?: string;
}

interface ImportResult {
  total: number;
  added: number;
  duplicates: number;
  failed: number;
}

export class EmailImportWorkerService {
  /**
   * Main entry-point called by the job worker.
   * Processes a large email list in chunks with per-chunk exponential backoff
   * and progress tracking.
   */
  async processImportJob(job: BackgroundJob): Promise<ImportResult> {
    const payload = job.payload as unknown as EmailImportPayload;
    const { groupId, userId, emails } = payload;

    if (!groupId || !Array.isArray(emails) || emails.length === 0) {
      throw new Error("[EmailImportWorker] Invalid job payload — missing groupId or emails");
    }

    // Verify the group still exists
    const group = await prisma.emailGroup.findFirst({
      where: { id: groupId, userId },
      select: { id: true },
    });

    if (!group) {
      throw new Error(`[EmailImportWorker] EmailGroup ${groupId} not found for user ${userId}`);
    }

    // De-duplicate the list before any DB work
    const uniqueEmails = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
    const total = uniqueEmails.length;

    const result: ImportResult = { total, added: 0, duplicates: 0, failed: 0 };

    const chunks = this.chunk(uniqueEmails, CHUNK_SIZE);
    const totalChunks = chunks.length;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const batch = chunks[chunkIndex];

      // Update progress so the client-side poller can show live status
      await jobQueueService.updateProgress(job.id, {
        current: chunkIndex * CHUNK_SIZE,
        total,
        message: `Processing chunk ${chunkIndex + 1} of ${totalChunks}…`,
        checkpoint: `chunk:${chunkIndex}`,
      });

      const chunkResult = await this.processChunkWithRetry(groupId, batch);
      result.added += chunkResult.added;
      result.duplicates += chunkResult.duplicates;
      result.failed += chunkResult.failed;

      // Backpressure: yield between chunks so the DB connection pool can breathe
      if (chunkIndex < totalChunks - 1) {
        await this.sleep(INTER_CHUNK_DELAY_MS);
      }
    }

    // Final progress update
    await jobQueueService.updateProgress(job.id, {
      current: total,
      total,
      message: `Import complete — ${result.added} added, ${result.duplicates} duplicates`,
      checkpoint: "done",
    });

    return result;
  }

  /**
   * Process a single chunk with per-chunk exponential backoff retry.
   * Duplicate emails are silently skipped thanks to `skipDuplicates`.
   */
  private async processChunkWithRetry(
    groupId: string,
    emails: string[]
  ): Promise<{ added: number; duplicates: number; failed: number }> {
    let lastError: unknown;

    for (let attempt = 0; attempt < CHUNK_MAX_RETRIES; attempt++) {
      try {
        // Optimistic approach: try createMany with skipDuplicates first
        const createResult = await prisma.emailAddress.createMany({
          data: emails.map((email) => ({ email, groupId })),
          skipDuplicates: true,
        });

        // createMany.count = number of rows actually inserted
        const added = createResult.count;
        const duplicates = emails.length - added;

        return { added, duplicates, failed: 0 };
      } catch (error: any) {
        lastError = error;

        // Non-retryable: constraint violations we can't recover from
        if (error?.code === "P2003") {
          // Foreign key violation — group deleted mid-job
          console.error("[EmailImportWorker] Foreign key violation — group likely deleted:", groupId);
          return { added: 0, duplicates: 0, failed: emails.length };
        }

        if (attempt < CHUNK_MAX_RETRIES - 1) {
          const backoffMs = CHUNK_BASE_BACKOFF_MS * Math.pow(2, attempt);
          console.warn(
            `[EmailImportWorker] Chunk error (attempt ${attempt + 1}/${CHUNK_MAX_RETRIES}), retrying in ${backoffMs}ms:`,
            error?.message || error
          );
          await this.sleep(backoffMs);
        }
      }
    }

    console.error("[EmailImportWorker] Chunk permanently failed after retries:", lastError);
    return { added: 0, duplicates: 0, failed: emails.length };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const emailImportWorkerService = new EmailImportWorkerService();
