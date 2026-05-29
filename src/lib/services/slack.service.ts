/**
 * Slack notification service.
 *
 * Architecture
 * ────────────
 *   User Action  →  notifySlack(payload)  →  BullMQ queue  →  worker
 *                                                            ↓
 *                                                            Slack webhook
 *
 * The originating API route enqueues and returns INSTANTLY. The worker
 * dispatches to the webhook with retries (4 attempts, 1s/2s/4s/8s exponential
 * backoff). Webhook failures never propagate back to the user-facing request.
 *
 * Channels
 * ────────
 *   ad-signups          Slack channel for new AD signups
 *   ticket-support      Slack channel for new support tickets
 *   parent-signup       Slack channel for new parent signups
 *   homepage-feedback   Slack channel for homepage form feedback
 *   parent-feedback     Slack channel for in-app parent feedback
 *   ad-feedback         Slack channel for in-app AD feedback
 *   critical-errors     Slack channel for 500s + caught exceptions
 *
 * Each channel maps to a separate webhook URL set in env:
 *   SLACK_AD_SIGNUPS_WEBHOOK
 *   SLACK_TICKET_SUPPORT_WEBHOOK
 *   SLACK_PARENT_SIGNUPS_WEBHOOK
 *   SLACK_HOMEPAGE_FEEDBACK_WEBHOOK
 *   SLACK_PARENT_FEEDBACK_WEBHOOK
 *   SLACK_AD_FEEDBACK_WEBHOOK
 *   SLACK_CRITICAL_ERRORS_WEBHOOK
 *
 * If Redis is unavailable, we fall back to a fire-and-forget HTTP POST so
 * notifications still go out (just without retry on failure).
 */

import type { SlackChannel, SlackNotifyPayload } from "@/lib/queue/queues";

export type { SlackChannel, SlackNotifyPayload };

const CHANNEL_TO_ENV: Record<SlackChannel, string> = {
  "ad-signups": "SLACK_AD_SIGNUPS_WEBHOOK",
  "ticket-support": "SLACK_TICKET_SUPPORT_WEBHOOK",
  "parent-signup": "SLACK_PARENT_SIGNUPS_WEBHOOK",
  "homepage-feedback": "SLACK_HOMEPAGE_FEEDBACK_WEBHOOK",
  "parent-feedback": "SLACK_PARENT_FEEDBACK_WEBHOOK",
  "ad-feedback": "SLACK_AD_FEEDBACK_WEBHOOK",
  "critical-errors": "SLACK_CRITICAL_ERRORS_WEBHOOK",
};

/** Look up the webhook URL for a channel. Returns null if env not set. */
export function getSlackWebhookUrl(channel: SlackChannel): string | null {
  const envKey = CHANNEL_TO_ENV[channel];
  const url = process.env[envKey];
  return url && url.trim() ? url.trim() : null;
}

const CHANNEL_TO_EMOJI: Record<SlackChannel, string> = {
  "ad-signups": ":tada:",
  "ticket-support": ":ticket:",
  "parent-signup": ":raising_hand:",
  "homepage-feedback": ":speech_balloon:",
  "parent-feedback": ":speech_balloon:",
  "ad-feedback": ":speech_balloon:",
  "critical-errors": ":rotating_light:",
};

/**
 * Build the Slack message blocks for a payload. Exported so the worker
 * and the in-process fallback share the exact same formatting.
 */
export function buildSlackMessage(payload: SlackNotifyPayload) {
  const emoji = CHANNEL_TO_EMOJI[payload.channel] ?? ":bell:";

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${payload.title}`, emoji: true },
    },
  ];

  if (payload.context && Object.keys(payload.context).length > 0) {
    const fields = Object.entries(payload.context)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({
        type: "mrkdwn" as const,
        text: `*${k}:*\n${String(v)}`,
      }));

    // Slack section field lists max out at 10 — split into chunks if needed.
    for (let i = 0; i < fields.length; i += 10) {
      blocks.push({ type: "section", fields: fields.slice(i, i + 10) });
    }
  }

  if (payload.message) {
    // Truncate long messages so we don't blow Slack's 3000-char block limit.
    const trimmed =
      payload.message.length > 2900
        ? payload.message.slice(0, 2897) + "..."
        : payload.message;
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Message:*\n${trimmed}` },
    });
  }

  return {
    text: `${emoji} ${payload.title}`,
    blocks,
  };
}

/**
 * In-process fallback dispatcher. Used when Redis/BullMQ is unavailable so
 * notifications still go out in dev or partial-outage scenarios. Errors are
 * logged and swallowed — Slack delivery never blocks a user request.
 */
async function dispatchInline(payload: SlackNotifyPayload): Promise<void> {
  const webhookUrl = getSlackWebhookUrl(payload.channel);
  if (!webhookUrl) {
    console.warn(`[slack] No webhook configured for channel "${payload.channel}", skipping notification`);
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSlackMessage(payload)),
    });
    if (!res.ok) {
      console.error(`[slack] Webhook returned ${res.status} for channel "${payload.channel}"`);
    }
  } catch (err) {
    console.error(`[slack] Inline dispatch failed for channel "${payload.channel}":`, err);
  }
}

/**
 * PUBLIC API — enqueue a Slack notification.
 *
 * Returns immediately. The originating request is never blocked on Slack
 * delivery. Wrap callers in try/catch only if you care about distinguishing
 * "enqueue failed" from "delivered" — for almost every use case, fire-and-forget
 * is correct because the user request shouldn't fail just because Slack
 * staff visibility is degraded.
 */
export async function notifySlack(payload: SlackNotifyPayload): Promise<void> {
  // Lazy-import so this module doesn't pull BullMQ when Redis is disabled.
  try {
    const { REDIS_ENABLED } = await import("@/lib/queue/connection");
    if (!REDIS_ENABLED) {
      // Dev / Redis-disabled path: dispatch inline, fire-and-forget.
      void dispatchInline(payload);
      return;
    }
    const { slackNotifyQueue } = await import("@/lib/queue/queues");
    await slackNotifyQueue.add("notify", payload);
  } catch (err) {
    // Enqueue itself failed — fall back to direct dispatch so we don't lose
    // the notification entirely. Logs the underlying reason for ops.
    console.error("[slack] Failed to enqueue, falling back to inline dispatch:", err);
    void dispatchInline(payload);
  }
}

// ─── Back-compat shim ─────────────────────────────────────────────────────────
// The old service exported a `slackService` singleton with named methods. Some
// existing call sites still use it. Each method now maps to the new channel
// model + notifySlack() so old code keeps working without changes.
//
// Prefer notifySlack(...) directly in new code.

export const slackService = {
  async sendSupportTicketNotification(params: {
    time: string;
    endpoint: string;
    customer: string;
    body: string;
  }): Promise<void> {
    await notifySlack({
      channel: "ticket-support",
      title: "New Support Ticket",
      message: params.body,
      context: {
        Time: params.time,
        Endpoint: params.endpoint,
        Customer: params.customer,
      },
    });
  },

  async sendFeedbackNotification(params: {
    time: string;
    endpoint: string;
    customer: string;
    body: string;
  }): Promise<void> {
    // Default legacy "feedback" calls to homepage-feedback. Newer call sites
    // should use notifySlack() with the explicit channel.
    await notifySlack({
      channel: "homepage-feedback",
      title: "New Feedback Submission",
      message: params.body,
      context: {
        Time: params.time,
        Endpoint: params.endpoint,
        Customer: params.customer,
      },
    });
  },

  async sendSignupNotification(params: {
    time: string;
    endpoint: string;
    customer: string;
    body: string;
  }): Promise<void> {
    await notifySlack({
      channel: "ad-signups",
      title: "New AD Signup",
      message: params.body,
      context: {
        Time: params.time,
        Endpoint: params.endpoint,
        Customer: params.customer,
      },
    });
  },

  async sendEmailSubscriptionNotification(params: {
    time: string;
    endpoint: string;
    customer: string;
    body: string;
  }): Promise<void> {
    // No dedicated channel — funnel into homepage-feedback (newsletter
    // subscriptions originate from the homepage form).
    await notifySlack({
      channel: "homepage-feedback",
      title: "New Email Subscription",
      message: params.body,
      context: {
        Time: params.time,
        Endpoint: params.endpoint,
        Customer: params.customer,
      },
    });
  },
};
