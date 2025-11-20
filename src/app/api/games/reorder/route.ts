import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

interface ReorderItem {
  id: string;
  sortOrder: number;
}

/**
 * POST /api/games/reorder
 *
 * Batch update sortOrder for games to support drag-and-drop reordering.
 * This endpoint accepts an array of { id, sortOrder } objects and updates
 * them atomically in a transaction.
 *
 * The reorder is user-specific and bypasses filters - the sortOrder is
 * saved as a static field in the database.
 *
 * @body { reorderedGames: Array<{ id: string, sortOrder: number }> }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = (await request.json().catch(() => null)) as { reorderedGames?: unknown } | null;
    if (!body || !Array.isArray(body.reorderedGames) || body.reorderedGames.length === 0) {
      return NextResponse.json({ error: "No reordered games provided" }, { status: 400 });
    }

    // Validate and sanitize input
    const reorderedGames: ReorderItem[] = [];
    for (const item of body.reorderedGames) {
      if (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "sortOrder" in item &&
        typeof item.id === "string" &&
        typeof item.sortOrder === "number"
      ) {
        reorderedGames.push({
          id: item.id,
          sortOrder: item.sortOrder,
        });
      }
    }

    if (reorderedGames.length === 0) {
      return NextResponse.json({ error: "No valid reorder items provided" }, { status: 400 });
    }

    const gameIds = reorderedGames.map((item) => item.id);

    // Verify all games exist and belong to user's organization
    const games = await prisma.game.findMany({
      where: {
        id: { in: gameIds },
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        id: true,
      },
    });

    const accessibleIds = new Set(games.map((game) => game.id));
    const missingIds = gameIds.filter((id) => !accessibleIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Games not found or unauthorized: ${missingIds.join(", ")}` },
        { status: 403 }
      );
    }

    // Perform batch update in a transaction
    await prisma.$transaction(
      reorderedGames.map((item) =>
        prisma.game.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return NextResponse.json(
      { success: true, updated: reorderedGames.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/games/reorder] Error:", error);
    return NextResponse.json(
      { error: "Failed to reorder games" },
      { status: 500 }
    );
  }
}
