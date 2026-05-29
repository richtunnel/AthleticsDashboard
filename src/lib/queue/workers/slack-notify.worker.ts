import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { SlackNotifyPayload } from "../queues";
import { buildSlackMessage, getSlackWebhookUrl } from "@/lib/services/slack.service";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Slack notification worker.
 *
 * Pulls SlackNotifyPayload jobs and dispatches them to the channel-specific
 * webhook URL. Failures throw so BullMQ retries with exponential backoff
 * (configured at queue level: 4 attempts, 1s/2s/4s/8s).
 *
 * Webhook URL lookup uses the same channel→env mapping as the in-process
 * fallback in slack.service.ts.
 */
export const slackNotifyWorker = new Worker<SlackNotifyPayload>(
  `${QUEUE_PREFIX}-slack-notify`,
  async (job: Job<SlackNotifyPayload>) => {
    const payload = job.data;
    const webhookUrl = getSlackWebhookUrl(payload.channel);

    if (!webhookUrl) {
      // No webhook configured for this channel. Log and complete the job —
      // retrying would be pointless because env vars don't change between
      // job attempts on the same worker process.
      console.warn(
        `[slack-worker] No webhook URL for channel "${payload.channel}", skipping job ${job.id}`
      );
      return { skipped: true, reason: "webhook_not_configured" };
    }

    const message = buildSlackMessage(payload);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      // Read the body for the error log so we know if Slack rejected the
      // payload shape, the webhook is dead, etc.
      const errorBody = await res.text().catch(() => "<unreadable>");
      throw new Error(
        `Slack webhook returned ${res.status} for channel "${payload.channel}": ${errorBody.slice(0, 200)}`
      );
    }

    return { delivered: true, channel: payload.channel };
  },
  {
    connection: bullConnection,
    // Slack accepts up to ~1 req/sec per webhook reliably. With 7 channels
    // we cap aggregate concurrency at 10 to stay well under any per-channel
    // rate limit while not bottle-necking spikes.
    concurrency: 10,
    limiter: { max: 60, duration: 60_000 }, // 60 sends/min global ceiling
  }
);

slackNotifyWorker.on("failed", (job, err) => {
  if (!job) return;
  console.error(
    `[slack-worker] job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}):`,
    err.message
  );
});
