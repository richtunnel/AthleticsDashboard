/**
 * Worker registry — importing this module starts every BullMQ worker.
 * Used by the worker process (src/scripts/queue-worker.ts).
 *
 * Do NOT import this from the Next.js app code — workers should only run
 * in the dedicated worker container.
 */

import { emailWorker, emailFanOutWorker } from "./email.worker";
import { calendarSyncWorker } from "./calendar.worker";
import { parentCalendarSyncWorker } from "./parent-calendar-sync.worker";
import { gameImportWorker, emailImportWorker } from "./import.worker";
import { stripeWebhookWorker } from "./stripe.worker";

export const workers = [
  emailWorker,
  emailFanOutWorker,
  calendarSyncWorker,
  parentCalendarSyncWorker,
  gameImportWorker,
  emailImportWorker,
  stripeWebhookWorker,
] as const;

export async function shutdownWorkers(): Promise<void> {
  console.log("[workers] shutting down…");
  await Promise.all(workers.map((w) => w.close()));
  console.log("[workers] shutdown complete");
}
