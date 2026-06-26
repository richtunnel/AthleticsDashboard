import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { GameCancelNotifyPayload } from "../queues";
import { prisma } from "../../database/prisma";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";

/**
 * Game Cancellation Notification Worker
 *
 * Triggered when an AD marks a game as CANCELLED. Finds all parents who are
 * watching the affected sport (via approved CalendarSyncRequests) and
 * invalidates their overview cache so they see the cancellation immediately
 * on next dashboard load.
 *
 * If parents have previously synced the game to their Google Calendar
 * (ParentGameCalendarEvent records exist) those events could be updated here
 * in a future iteration — for now cache invalidation + the CANCELLED status
 * displayed on the parent dashboard is the notification mechanism.
 */
export const gameCancelNotifyWorker = new Worker<GameCancelNotifyPayload>(
  `${QUEUE_PREFIX}-game-cancel-notify`,
  async (job: Job<GameCancelNotifyPayload>) => {
    const { gameId, organizationId } = job.data;

    // ── 1. Parents who already have this game in their Google Calendar ────────
    const parentGameEvents = await prisma.parentGameCalendarEvent.findMany({
      where: { gameId },
      select: { parentUserId: true },
    });

    // ── 2. All parents with an approved sync request for this school ──────────
    // (Catches parents who haven't pushed the game yet but will care about the
    // cancellation when they next open their dashboard)
    const approvedRequests = await prisma.calendarSyncRequest.findMany({
      where: { schoolId: organizationId, status: "APPROVED" },
      select: { parentUserId: true },
    });

    const parentIds = new Set<string>([
      ...parentGameEvents.map((e) => e.parentUserId),
      ...approvedRequests.map((r) => r.parentUserId),
    ]);

    if (parentIds.size === 0) {
      console.log(`[gameCancelNotifyWorker] game ${gameId}: no parents to notify`);
      return { notified: 0 };
    }

    // ── 3. Invalidate each parent's overview cache ────────────────────────────
    // The next dashboard load will re-fetch with the CANCELLED status and
    // render the strikethrough card.
    try {
      const { invalidate } = await import("@/lib/cache/redisCache");
      await Promise.allSettled(
        [...parentIds].map((uid) => invalidate(`parent:overview:${uid}`))
      );
    } catch {
      // Non-fatal: next load will show stale data until TTL expires (30 s)
      console.warn(`[gameCancelNotifyWorker] cache invalidation failed for game ${gameId}`);
    }

    console.log(
      `[gameCancelNotifyWorker] game ${gameId} cancelled — invalidated cache for ${parentIds.size} parent(s)`
    );
    return { notified: parentIds.size };
  },
  {
    connection: bullConnection,
    concurrency: 5,
    settings: {
      stalledInterval: 30_000,
      maxStalledCount: 1,
    },
  }
);

gameCancelNotifyWorker.on("error", (err) => {
  console.error("[gameCancelNotifyWorker] worker error:", err.message);
});
gameCancelNotifyWorker.on("stalled", (jobId) => {
  console.warn(`[gameCancelNotifyWorker] job ${jobId} stalled — re-queued for retry`);
});
gameCancelNotifyWorker.on("failed", (job, err) => {
  console.error(
    `[gameCancelNotifyWorker] job ${job?.id} failed:`,
    err.message
  );
});
