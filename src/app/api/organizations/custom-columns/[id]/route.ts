import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id: columnId } = await params;

    if (!columnId) {
      return new Response(JSON.stringify({ error: "Column ID is required" }), { status: 400 });
    }

    // Validate: Is this a custom column or built-in?
    const column = await prisma.customColumn.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return new Response(JSON.stringify({ error: "Column not found or cannot be deleted (built-in column)" }), { status: 404 });
    }

    if (column.organizationId !== session.user.organizationId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // Delete the column
    await prisma.customColumn.delete({
      where: { id: columnId },
    });

    // Clean up customData in all relevant games
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        id: true,
        customData: true,
      },
    });

    for (const game of games) {
      if (game.customData && typeof game.customData === 'object' && columnId in game.customData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newCustomData = { ...(game.customData as any) };
        delete newCustomData[columnId];
        await prisma.game.update({
          where: { id: game.id },
          data: { customData: newCustomData },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Column deleted successfully" }));
  } catch (error) {
    console.error("Error deleting custom column:", error);
    return new Response(JSON.stringify({ error: "Failed to delete custom column" }), { status: 500 });
  }
}
