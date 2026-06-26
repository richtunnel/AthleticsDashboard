/**
 * Game Request Confirmation Worker
 *
 * Triggered when a requester confirms an approved game request
 * (GameRequest.status transitions to CONFIRMED). Sends a confirmation
 * email to BOTH the owner AD and the requester AD via the existing
 * Resend/BullMQ email pipeline.
 *
 * Payload shape:  { gameRequestId: string }
 * Triggered by:   PUT /api/game-requests/[id]/confirm
 */

import { Worker, type Job } from "bullmq";
import { bullConnection } from "../connection";
import type { GameRequestConfirmPayload } from "../queues";
import { prisma } from "../../database/prisma";
import { emailService } from "../../services/email.service";
import { formatGameDate, formatGameTime, sportComboLabel } from "../../utils/formatGameDateTime";

const QUEUE_PREFIX = process.env.BULLMQ_PREFIX || "opletics";
const TZ_DEFAULT   = "America/New_York";

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
    console.log(`[gameRequestConfirmWorker] skipping ${gameRequestId} — not CONFIRMED`);
    return;
  }

  const tz        = gr.requester?.organization?.timezone ?? gr.owner?.organization?.timezone ?? TZ_DEFAULT;
  const dateLabel = formatGameDate(gr.availableDate.toISOString(), tz);
  const timeLabel = formatGameTime(gr.availableTimeWindow, tz);
  const combo     = sportComboLabel(gr.sport, gr.level, gr.gender);

  const requesterSchool = gr.requester?.schoolName || gr.requester?.name || "Your opponent";
  const ownerSchool     = gr.owner?.schoolName     || gr.owner?.name     || "Your opponent";

  const dashboardUrl = "https://opletics.com/dashboard/posts?tab=3";

  const emails: Promise<unknown>[] = [];

  if (gr.owner?.email) {
    const ownerIsHome = !gr.isHomeForRequester;
    emails.push(emailService.sendEmail({
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
    }));
  }

  if (gr.requester?.email) {
    emails.push(emailService.sendEmail({
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
    }));
  }

  await Promise.all(emails);
  console.log(`[gameRequestConfirmWorker] emails sent for request ${gameRequestId}`);
}

export const gameRequestConfirmWorker = new Worker<GameRequestConfirmPayload>(
  `${QUEUE_PREFIX}-game-request-confirm`,
  async (job: Job<GameRequestConfirmPayload>) => {
    const { gameRequestId } = job.data;
    await processGameRequestConfirm(gameRequestId);
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

gameRequestConfirmWorker.on("error", (err) => {
  console.error("[gameRequestConfirmWorker] worker error:", err.message);
});
gameRequestConfirmWorker.on("stalled", (jobId) => {
  console.warn(`[gameRequestConfirmWorker] job ${jobId} stalled — re-queued for retry`);
});
gameRequestConfirmWorker.on("failed", (job, err) => {
  console.error(`[gameRequestConfirmWorker] job ${job?.id} failed:`, err.message);
});
