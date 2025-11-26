import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { deleteSampleGames } from "@/lib/services/sample-game.service";

/**
 * DELETE - Delete all sample games for the authenticated user
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();

    const deletedCount = await deleteSampleGames(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        message: `Successfully deleted ${deletedCount} sample game(s)`,
      },
    });
  } catch (error) {
    console.error("[API] Failed to delete sample games:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete sample games",
      },
      { status: 500 }
    );
  }
}
