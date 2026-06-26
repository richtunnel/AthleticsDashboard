import { Queue, QueueEvents, type JobsOptions } from "bullmq";
import { bullConnection, REDIS_ENABLED } from "./connection";

/**
 * Throw a clear error if anything tries to enqueue while Redis is disabled.
 * Use at the top of any service method that calls `queue.add(…)`.
 */
export function assertQueueEnabled(featureName: string): void {
  if (!REDIS_ENABLED) {
    throw new Error(
      `[BullMQ] Cannot ${featureName}: Redis is disabled. ` +
        `Set REDIS_URL=redis://localhost:6379 (and run a local Redis) to enable.`
    );
  }
}

export { REDIS_ENABLED };

/**
 * Typed BullMQ queues for every async workload in the app.
 *
 * Naming: `app:<area>` so multiple environments / branches can share Redis.
 * Adjust QUEUE_PREFIX if you ever run staging + prod against the same Redis.
 */
// BullMQ disallows `:` in queue names (it reserves the colon for Redis key
// namespacing internally). Use `-` between prefix and queue name.
const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

// ── Priority levels — lower number = higher priority ──────────────────────────
export const Priority = {
  CRITICAL: 1,   // Password resets, payment confirmations
  HIGH: 5,       // Transactional (sync request notifications)
  NORMAL: 10,    // Bulk notifications
  LOW: 20,       // Bulk marketing campaigns
} as const;

// ── Per-recipient email job payload ───────────────────────────────────────────
export interface EmailJobPayload {
  /** EmailJob row ID — worker updates this row on completion */
  parentJobId: string;
  /** EmailRecipient row ID — single recipient slice */
  recipientId: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Sender's user ID for audit + rate limiting */
  sentById: string;
}

// ── Bulk campaign fan-out payload ─────────────────────────────────────────────
export interface BulkEmailFanOutPayload {
  parentJobId: string;
  organizationId: string;
}

// ── Calendar sync payload ─────────────────────────────────────────────────────
export interface CalendarSyncPayload {
  userId: string;
  organizationId: string;
  /** Optional BackgroundJob row ID for progress tracking */
  backgroundJobId?: string;
}

// ── Parent's per-sport calendar sync ──────────────────────────────────────────
// Smaller-scoped than CalendarSyncPayload: pushes ONE sport's games to one
// parent's Google Calendar. Used by the "Update Sync" action on the parent
// dashboard. Idempotency token prevents duplicate jobs on double-click.
export interface ParentCalendarSyncPayload {
  /** BackgroundJob row ID — used as the public "job ID" the client polls. */
  backgroundJobId: string;
  /** Client-supplied (or server-generated) idempotency token */
  token: string;
  parentUserId: string;
  syncRequestId: string;
  schoolId: string;
  sportName: string;
  sportLevel: string;
  googleCalendarId: string;
  /**
   * GamesWorkbook ID the AD scoped this request to.
   * When set, the worker queries by workbookId instead of a broad org scan —
   * much faster and avoids cross-sport false positives.
   */
  workbookId?: string | null;
  /**
   * Normalised gender (boys | girls | mixed) set by the AD on approval.
   * Passed to syncGamesForSportLevel to tighten the team-match filter.
   */
  gender?: string | null;
}

// ── Game import payload ───────────────────────────────────────────────────────
export interface GameImportPayload {
  backgroundJobId: string;
  userId: string;
  organizationId: string;
  spreadsheetId?: string;
  // The rest of import payload is opaque — handler resolves from BackgroundJob row
  [key: string]: unknown;
}

// ── Email import payload ──────────────────────────────────────────────────────
export interface EmailImportPayload {
  backgroundJobId: string;
  userId: string;
  organizationId: string;
  groupId: string;
  [key: string]: unknown;
}

// ── Game request confirmation payload ────────────────────────────────────────
export interface GameRequestConfirmPayload {
  gameRequestId: string;
}

// ── Game cancellation parent-notification payload ─────────────────────────────
export interface GameCancelNotifyPayload {
  /** The game that was cancelled */
  gameId: string;
  /** AD's organisation — used to scope the approved-request lookup */
  organizationId: string;
}

// ── Stripe webhook payload ────────────────────────────────────────────────────
export interface StripeWebhookPayload {
  eventId: string;
  /** Full Stripe event JSON */
  event: Record<string, unknown>;
}

// ── Slack notification payload ────────────────────────────────────────────────
/**
 * One job per Slack notification. Lands the user's action on a dedicated
 * BullMQ queue so the originating API route returns immediately while the
 * worker hits the Slack webhook with retries + exponential backoff.
 */
export type SlackChannel =
  | "ad-signups"
  | "ticket-support"
  | "parent-signup"
  | "homepage-feedback"
  | "parent-feedback"
  | "ad-feedback"
  | "critical-errors";

export interface SlackNotifyPayload {
  channel: SlackChannel;
  /** Top-line summary — also used as the Slack fallback text. */
  title: string;
  /** Optional body text rendered as a Markdown section. */
  message?: string;
  /** Rich context displayed as a Slack fields list (key → value pairs). */
  context?: Record<string, string | number | boolean | null | undefined>;
}

// ── Default job options ───────────────────────────────────────────────────────
const baseJobOptions: JobsOptions = {
  // Exponential backoff on failure: 2s, 4s, 8s…
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  // Keep last 1000 completed and 5000 failed jobs for inspection
  removeOnComplete: { age: 24 * 3600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3600, count: 5_000 },
};

// ── Queue singletons ──────────────────────────────────────────────────────────

/**
 * Per-recipient email sends.
 * Rate-limited at the WORKER level (see workers/email.worker.ts) to respect
 * SMTP provider limits (Resend free tier is 100 emails/sec).
 */
export const emailQueue = new Queue<EmailJobPayload>(`${QUEUE_PREFIX}-email`, {
  connection: bullConnection,
  defaultJobOptions: { ...baseJobOptions, priority: Priority.NORMAL },
});

/**
 * Fan-out queue — takes a bulk EmailJob and pushes one job per recipient
 * onto the emailQueue. Kept separate so a 10k-recipient campaign doesn't
 * block transactional emails behind it.
 */
export const emailFanOutQueue = new Queue<BulkEmailFanOutPayload>(
  `${QUEUE_PREFIX}-email-fanout`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.LOW },
  }
);

/**
 * Google Calendar sync. Concurrency-limited to respect Google API quotas.
 */
export const calendarSyncQueue = new Queue<CalendarSyncPayload>(
  `${QUEUE_PREFIX}-calendar-sync`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.NORMAL },
  }
);

/**
 * Per-parent / per-sport calendar push.
 *
 * Smaller, higher-priority queue than the AD-wide sync — parents wait on
 * these synchronously in the UI so they need fast pickup. Concurrency stays
 * low because each job hits the Google Calendar API per game.
 */
export const parentCalendarSyncQueue = new Queue<ParentCalendarSyncPayload>(
  `${QUEUE_PREFIX}-parent-calendar-sync`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.HIGH },
  }
);

/** Spreadsheet → games imports (long-running). */
export const gameImportQueue = new Queue<GameImportPayload>(
  `${QUEUE_PREFIX}-game-import`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.NORMAL },
  }
);

/** Email-list imports. */
export const emailImportQueue = new Queue<EmailImportPayload>(
  `${QUEUE_PREFIX}-email-import`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.NORMAL },
  }
);

/**
 * Game request confirmation emails — sent to both ADs when the requester
 * confirms an approved game request.
 */
export const gameRequestConfirmQueue = new Queue<GameRequestConfirmPayload>(
  `${QUEUE_PREFIX}-game-request-confirm`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.HIGH },
  }
);

/**
 * Notifies affected parents when an AD cancels a game.
 * Invalidates their overview caches so the cancelled game surfaces immediately
 * on next dashboard load.
 */
export const gameCancelNotifyQueue = new Queue<GameCancelNotifyPayload>(
  `${QUEUE_PREFIX}-game-cancel-notify`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.HIGH },
  }
);

/**
 * Stripe webhooks — process asynchronously so the webhook endpoint can ack
 * within Stripe's 5s timeout even when DB writes are slow.
 */
export const stripeWebhookQueue = new Queue<StripeWebhookPayload>(
  `${QUEUE_PREFIX}-stripe-webhook`,
  {
    connection: bullConnection,
    defaultJobOptions: { ...baseJobOptions, priority: Priority.CRITICAL },
  }
);

/**
 * Slack notifications. CRITICAL priority because the user-facing API route
 * has already returned by the time we enqueue — Slack delivery latency only
 * matters for staff visibility, not user wait time. Capped attempts so we
 * don't retry-storm a flapping webhook.
 */
export const slackNotifyQueue = new Queue<SlackNotifyPayload>(
  `${QUEUE_PREFIX}-slack-notify`,
  {
    connection: bullConnection,
    defaultJobOptions: {
      ...baseJobOptions,
      attempts: 4,
      backoff: { type: "exponential", delay: 1_000 }, // 1s, 2s, 4s, 8s
      priority: Priority.CRITICAL,
    },
  }
);

// ── QueueEvents (optional, for real-time UI updates if needed) ────────────────
// QueueEvents opens a Redis subscription in its constructor, unlike Queue which
// is truly lazy. Gate it behind REDIS_ENABLED so `next build` and Redis-disabled
// environments never trigger a connection attempt.
export const emailQueueEvents = REDIS_ENABLED
  ? new QueueEvents(`${QUEUE_PREFIX}-email`, { connection: bullConnection })
  : null;

// ── Convenience: a typed map for monitoring/inspection ────────────────────────
export const allQueues = {
  email: emailQueue,
  emailFanOut: emailFanOutQueue,
  calendarSync: calendarSyncQueue,
  parentCalendarSync: parentCalendarSyncQueue,
  gameImport: gameImportQueue,
  emailImport: emailImportQueue,
  gameRequestConfirm: gameRequestConfirmQueue,
  gameCancelNotify: gameCancelNotifyQueue,
  stripeWebhook: stripeWebhookQueue,
  slackNotify: slackNotifyQueue,
} as const;
