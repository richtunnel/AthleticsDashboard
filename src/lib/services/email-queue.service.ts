import { prisma } from "../database/prisma";
import { emailLimitService } from "./email-limit.service";
import {
  emailFanOutQueue,
  emailQueue,
  Priority,
  assertQueueEnabled,
  type EmailJobPayload,
} from "../queue/queues";
import { EmailJobStatus, EmailRecipientStatus } from "@prisma/client";

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
  /** Priority level — defaults to NORMAL. Use HIGH for transactional. */
  priority?: number;
}

/**
 * Email queue service.
 *
 * Strategy
 * ────────
 * 1. Validate against per-user limits.
 * 2. Create an EmailJob row (audit/UI) with one EmailRecipient per address.
 * 3. Enqueue a fan-out job on BullMQ. The fan-out worker pushes one job per
 *    recipient onto the email queue, which is rate-limited to respect SMTP
 *    provider quotas.
 *
 * The DB tables (EmailJob, EmailRecipient) remain the source of truth for
 * the UI; BullMQ is purely the dispatching layer.
 */
export class EmailQueueService {
  async enqueueBulkEmail(params: BulkEmailParams) {
    assertQueueEnabled("send bulk email");
    const {
      userId,
      organizationId,
      to,
      subject,
      body,
      replyTo,
      gameIds = [],
      groupId,
      campaignId,
      recipientCategory,
      additionalMessage,
      visibleColumnIds = [],
      selectedSchoolNames = [],
      idempotencyKey,
      priority = Priority.NORMAL,
    } = params;

    // ── 1. Per-user limit check ──────────────────────────────────────────
    const limitCheck = await emailLimitService.checkEmailLimits(userId, to.length);
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || "Email limit exceeded");
    }

    // ── 2. Idempotency — block duplicate submissions ─────────────────────
    if (idempotencyKey) {
      const existing = await prisma.emailJob.findFirst({
        where: {
          userId,
          status: { in: [EmailJobStatus.PENDING, EmailJobStatus.PROCESSING] },
          // We use a marker in campaignId since EmailJob has no idempotencyKey column
          campaignId: idempotencyKey,
        },
        select: { id: true, status: true },
      });
      if (existing) return { id: existing.id, status: existing.status };
    }

    // ── 3. Persist EmailJob + per-recipient rows for the UI ──────────────
    const parentJob = await prisma.$transaction(async (tx) => {
      const job = await tx.emailJob.create({
        data: {
          userId,
          organizationId,
          subject,
          body,
          replyTo: replyTo ?? null,
          status: EmailJobStatus.PENDING,
          totalCount: to.length,
          gameIds,
          groupId: groupId ?? null,
          campaignId: campaignId ?? idempotencyKey ?? null,
          recipientCategory: recipientCategory ?? null,
          additionalMessage: additionalMessage ?? null,
          visibleColumnIds,
          selectedSchoolNames,
        },
      });

      // Create recipients in chunks to avoid hitting query size limits on huge campaigns
      const CHUNK = 1_000;
      for (let i = 0; i < to.length; i += CHUNK) {
        const slice = to.slice(i, i + CHUNK);
        await tx.emailRecipient.createMany({
          data: slice.map((email) => ({
            jobId: job.id,
            email: email.trim().toLowerCase(),
            status: EmailRecipientStatus.PENDING,
          })),
        });
      }

      return job;
    });

    // ── 4. Dispatch ──────────────────────────────────────────────────────
    // Small jobs (≤ 50 recipients) — push directly, skip fan-out latency.
    // Larger jobs — fan out via dedicated queue so a 10k blast doesn't
    // block transactional sends.
    if (to.length <= 50) {
      const recipients = await prisma.emailRecipient.findMany({
        where: { jobId: parentJob.id, status: EmailRecipientStatus.PENDING },
        select: { id: true, email: true },
      });

      await emailQueue.addBulk(
        recipients.map((r) => ({
          name: "send",
          data: {
            parentJobId: parentJob.id,
            recipientId: r.id,
            to: r.email,
            subject,
            html: body,
            replyTo,
            sentById: userId,
          } satisfies EmailJobPayload,
          opts: { priority },
        }))
      );

      await prisma.emailJob.update({
        where: { id: parentJob.id },
        data: { status: EmailJobStatus.PROCESSING },
      });
    } else {
      await emailFanOutQueue.add(
        "fanout",
        { parentJobId: parentJob.id, organizationId },
        { priority }
      );
    }

    return { id: parentJob.id, status: EmailJobStatus.PENDING };
  }

  /**
   * Convenience for transactional emails (password reset, payment confirmation).
   * Skips the bulk path and goes straight to the queue with CRITICAL priority.
   */
  async sendTransactional(params: {
    userId: string;
    organizationId: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }) {
    return this.enqueueBulkEmail({
      userId: params.userId,
      organizationId: params.organizationId,
      to: [params.to],
      subject: params.subject,
      body: params.html,
      replyTo: params.replyTo,
      priority: Priority.CRITICAL,
    });
  }
}

export const emailQueueService = new EmailQueueService();
