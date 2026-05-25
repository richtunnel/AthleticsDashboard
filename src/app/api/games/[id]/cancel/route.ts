import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { gameCancelNotifyQueue, REDIS_ENABLED } from "@/lib/queue/queues";

/**
 * POST /api/games/:id/cancel
 *
 * Marks a game as CANCELLED and enqueues a background job that invalidates
 * the overview cache for every parent synced to that sport, so they see the
 * cancellation on their next dashboard load.
 *
 * The status update is synchronous (fast DB write). The parent notification
 * is async so it never blocks the AD's request.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: gameId } = await params;

    // Verify ownership: game must belong to the AD's org
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId: session.user.organizationId },
      },
      select: { id: true, status: true },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status === "CANCELLED") {
      return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    // ── Synchronous: update the game status ───────────────────────────────────
    await prisma.game.update({
      where: { id: gameId },
      data: { status: "CANCELLED" },
    });

    // ── Async: notify affected parents (retryable, exponential backoff) ───────
    if (REDIS_ENABLED) {
      await gameCancelNotifyQueue.add(
        `cancel-${gameId}`,
        { gameId, organizationId: session.user.organizationId },
        {
          // Dedup: only one notification job per game cancellation
          jobId: `cancel-notify-${gameId}`,
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/games/[id]/cancel]", error);
    return NextResponse.json({ error: "Failed to cancel game" }, { status: 500 });
  }
}
