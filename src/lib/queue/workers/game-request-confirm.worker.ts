/**
 * Game Request Confirmation Worker
 *
 * Triggered when a requester confirms an approved game request
 * (GameRequest.status transitions to CONFIRMED). Sends a confirmation
 * email to BOTH the owner AD and the requester AD via the existing
 * Resend/BullMQ email pipeline.
 *
 * Payload shape:  { gameRequestId: string }
 * Triggered by:   PUT /api/game-requests/[id]/confirm  (creates BackgroundJob)
 */

import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { formatGameDate, formatGameTime, sportComboLabel } from "@/lib/utils/formatGameDateTime";

const TZ_DEFAULT = "America/New_York";

async function processGameRequestConfirm(gameRequestId: string) {
  const gr = await prisma.gameRequest.findUnique({
    where: { id: gameRequestId },
    include: {
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          schoolName: true,
          organization: { select: { timezone: true } },
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          schoolName: true,
          organization: { select: { timezone: true } },
        },
      },
    },
  });

  if (!gr || gr.status !== "CONFIRMED") {
    console.log(`[game-request-confirm.worker] skipping ${gameRequestId} — not CONFIRMED`);
    return;
  }

  const tz        = gr.requester?.organization?.timezone ?? gr.owner?.organization?.timezone ?? TZ_DEFAULT;
  const dateLabel = formatGameDate(gr.availableDate.toISOString(), tz);
  const timeLabel = formatGameTime(gr.availableTimeWindow, tz);
  const combo     = sportComboLabel(gr.sport, gr.level, gr.gender);

  const requesterSchool = gr.requester?.schoolName || gr.requester?.name || "Your opponent";
  const ownerSchool     = gr.owner?.schoolName     || gr.owner?.name     || "Your opponent";

  const dashboardUrl = "https://opletics.com/dashboard/posts?tab=3";

  // Email to OWNER
  if (gr.owner?.email) {
    const ownerIsHome = !gr.isHomeForRequester;
    await emailService.sendEmail({
      to:      [gr.owner.email],
      subject: `🏆 Game Confirmed — ${combo} vs. ${requesterSchool}`,
      body: `Hi ${gr.owner.name || "Coach"},

Great news! Your ${combo} game with ${requesterSchool} has been confirmed.

📅 Date:    ${dateLabel}
⏰ Time:    ${timeLabel}
🏠 You are: ${ownerIsHome ? "Home" : "Away"}
📋 Sport:   ${combo}

Both sides have confirmed this game. Head to your dashboard to view the details and sync it to your schedule.

View game requests: ${dashboardUrl}

Go Opletics!`,
      immediate: true,
    });
  }

  // Email to REQUESTER
  if (gr.requester?.email) {
    await emailService.sendEmail({
      to:      [gr.requester.email],
      subject: `🏆 Game Confirmed — ${combo} vs. ${ownerSchool}`,
      body: `Hi ${gr.requester.name || "Coach"},

Your ${combo} game with ${ownerSchool} is officially on the books!

📅 Date:    ${dateLabel}
⏰ Time:    ${timeLabel}
🏠 You are: ${gr.isHomeForRequester ? "Home" : "Away"}
📋 Sport:   ${combo}

Don't forget to sync this game to your worksheet from your dashboard.

View game requests: ${dashboardUrl}

Go Opletics!`,
      immediate: true,
    });
  }

  console.log(`[game-request-confirm.worker] emails sent for request ${gameRequestId}`);
}

/**
 * Poll-based processor: called by a cron/background runner that picks up
 * GAME_REQUEST_CONFIRM BackgroundJobs. Follows the same pattern as other
 * BackgroundJob processors in this codebase.
 */
export async function runGameRequestConfirmWorker() {
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      type:   "GAME_REQUEST_CONFIRM",
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  for (const job of jobs) {
    // Mark processing
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data:  { status: "PROCESSING", lastAttemptAt: new Date(), attempts: { increment: 1 } },
    });

    try {
      const payload = job.payload as { gameRequestId?: string };
      if (!payload.gameRequestId) throw new Error("Missing gameRequestId in payload");
      await processGameRequestConfirm(payload.gameRequestId);

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETED", completedAt: new Date() },
      });
    } catch (err) {
      const msg         = err instanceof Error ? err.message : String(err);
      const nextAttempt = job.attempts + 1 >= (job.maxAttempts ?? 5)
        ? undefined
        : new Date(Date.now() + 60_000 * (job.attempts + 1)); // exp back-off

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: nextAttempt ? "PENDING" : "FAILED",
          error:  msg,
          failedAt: nextAttempt ? undefined : new Date(),
          nextAttemptAt: nextAttempt,
        },
      });

      console.error(`[game-request-confirm.worker] job ${job.id} failed: ${msg}`);
    }
  }
}
