import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import {
  emailQueue,
  emailFanOutQueue,
  type EmailJobPayload,
  type BulkEmailFanOutPayload,
  Priority,
} from "../queues";
import { prisma } from "../../database/prisma";
import { emailGatewayService } from "../../services/email-gateway.service";
import { EmailJobStatus, EmailRecipientStatus } from "@prisma/client";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

// ── Email send worker ────────────────────────────────────────────────────────
/**
 * Processes one recipient per job.
 *
 * Concurrency: 10 parallel sends per worker process.
 * Rate limit: 100 emails per second (matches Resend free tier).
 *
 * On success → marks EmailRecipient as SENT and increments EmailJob.sentCount.
 * On failure → BullMQ auto-retries up to 5x with exponential backoff. After
 *              the last attempt fails, the `failed` event marks the recipient
 *              FAILED in the DB so the UI can show it.
 */
export const emailWorker = new Worker<EmailJobPayload>(
  `${QUEUE_PREFIX}-email`,
  async (job: Job<EmailJobPayload>) => {
    const { parentJobId, recipientId, to, subject, html, replyTo } = job.data;

    // Mark recipient as in-flight
    await prisma.emailRecipient.update({
      where: { id: recipientId },
      data: {
        status: EmailRecipientStatus.RETRYING,
        lastAttempt: new Date(),
        retryCount: { increment: 1 },
      },
    }).catch(() => { /* recipient may have been deleted */ });

    const result = await emailGatewayService.send({ to, subject, html, replyTo });

    if (!result.success) {
      // Throw so BullMQ records the failure and schedules a retry.
      throw new Error(result.error ?? "unknown gateway error");
    }

    // Success — atomic update: delete recipient + bump sentCount + log
    await prisma.$transaction([
      prisma.emailRecipient.delete({ where: { id: recipientId } }),
      prisma.emailJob.update({
        where: { id: parentJobId },
        data: { sentCount: { increment: 1 } },
      }),
      prisma.emailLog.create({
        data: {
          to: [to],
          subject,
          body: html,
          replyTo: replyTo ?? null,
          status: "SENT",
          sentAt: new Date(),
          sentById: job.data.sentById,
        },
      }),
    ]).catch((e) => {
      console.error("[emailWorker] post-send DB update failed:", e);
    });

    return { sent: 1 };
  },
  {
    connection: bullConnection,
    concurrency: 10,
    limiter: {
      max: 100,         // up to 100 jobs
      duration: 1_000,  // per 1 second
    },
  }
);

// Final-failure handler — runs after BullMQ exhausts all retries
emailWorker.on("failed", async (job, err) => {
  if (!job) return;
  console.error(`[emailWorker] job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);

  if (job.attemptsMade >= (job.opts.attempts ?? 5)) {
    await prisma.emailRecipient.update({
      where: { id: job.data.recipientId },
      data: {
        status: EmailRecipientStatus.FAILED,
        error: err.message.slice(0, 500),
      },
    }).catch(() => {});

    await prisma.emailJob.update({
      where: { id: job.data.parentJobId },
      data: { failedCount: { increment: 1 } },
    }).catch(() => {});
  }
});

// ── Fan-out worker ───────────────────────────────────────────────────────────
/**
 * Takes a parent EmailJob and pushes one job per pending recipient onto the
 * email queue. Runs at lower concurrency since each fan-out can enqueue
 * thousands of jobs.
 */
export const emailFanOutWorker = new Worker<BulkEmailFanOutPayload>(
  `${QUEUE_PREFIX}-email-fanout`,
  async (job: Job<BulkEmailFanOutPayload>) => {
    const { parentJobId } = job.data;

    const parentJob = await prisma.emailJob.findUnique({
      where: { id: parentJobId },
      include: { recipients: { where: { status: EmailRecipientStatus.PENDING } } },
    });

    if (!parentJob) throw new Error(`EmailJob ${parentJobId} not found`);
    if (parentJob.recipients.length === 0) {
      await prisma.emailJob.update({
        where: { id: parentJobId },
        data: { status: EmailJobStatus.COMPLETED },
      });
      return { enqueued: 0 };
    }

    // Mark parent job as PROCESSING
    await prisma.emailJob.update({
      where: { id: parentJobId },
      data: { status: EmailJobStatus.PROCESSING },
    });

    // Bulk-add all recipient jobs. BullMQ handles thousands efficiently.
    const jobs = parentJob.recipients.map((r) => ({
      name: "send",
      data: {
        parentJobId,
        recipientId: r.id,
        to: r.email,
        subject: parentJob.subject,
        html: parentJob.body,
        replyTo: parentJob.replyTo ?? undefined,
        sentById: parentJob.userId,
      } satisfies EmailJobPayload,
      opts: { priority: Priority.NORMAL },
    }));

    await emailQueue.addBulk(jobs);
    return { enqueued: jobs.length };
  },
  {
    connection: bullConnection,
    concurrency: 2,
  }
);

emailFanOutWorker.on("failed", (job, err) => {
  console.error(`[emailFanOutWorker] job ${job?.id} failed:`, err.message);
});
