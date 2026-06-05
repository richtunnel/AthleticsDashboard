import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { StripeWebhookPayload } from "../queues";
import { stripeWebhookService } from "../../services/stripe-webhook.service";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Stripe webhook worker — high concurrency for fast processing.
 * Webhooks are idempotent (Stripe sends event IDs we dedup on).
 */
export const stripeWebhookWorker = new Worker<StripeWebhookPayload>(
  `${QUEUE_PREFIX}-stripe-webhook`,
  async (job: Job<StripeWebhookPayload>) => {
    return await stripeWebhookService.processWebhookEvent(job.data.event as any);
  },
  {
    connection: bullConnection,
    concurrency: 10,
  }
);

stripeWebhookWorker.on("failed", (job, err) => {
  console.error(`[stripeWebhookWorker] event ${job?.data.eventId} failed:`, err.message);
});
