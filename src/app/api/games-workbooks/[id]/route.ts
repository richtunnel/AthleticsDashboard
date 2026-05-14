import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

// PATCH - update workbook (rename)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workbookId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Verify ownership
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: {
        id: workbookId,
        userId: session.user.id,
      },
    });

    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    const updatedWorkbook = await prisma.gamesWorkbook.update({
      where: {
        id: workbookId,
      },
      data: {
        name,
      },
    });

    trackEvent("Games Workbook Renamed", {
      userId: session.user.id,
      workbookId: workbookId,
      oldName: workbook.name,
      newName: name,
    });

    return NextResponse.json({ data: updatedWorkbook });
  } catch (error) {
    console.error("Error updating games workbook:", error);
    return NextResponse.json({ error: "Failed to update workbook" }, { status: 500 });
  }
}

// DELETE - delete a workbook
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workbookId } = await params;

    // Verify ownership
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: {
        id: workbookId,
        userId: session.user.id,
      },
    });

    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    // Count games so we can include it in analytics
    const gameCount = await prisma.game.count({
      where: { workbookId },
    });

    // Cascade-delete all games in this workbook first
    if (gameCount > 0) {
      await prisma.game.deleteMany({
        where: { workbookId },
      });
    }

    // Clean up the isolated column-preference record for this workbook
    await prisma.tablePreference.deleteMany({
      where: { tableKey: `games-${workbookId}` },
    });

    await prisma.gamesWorkbook.delete({
      where: { id: workbookId },
    });

    trackEvent("Games Workbook Deleted", {
      userId: session.user.id,
      workbookId,
      workbookName: workbook.name,
      gameCount,
    });

    return NextResponse.json({ data: { id: workbookId } });
  } catch (error) {
    console.error("Error deleting games workbook:", error);
    return NextResponse.json({ error: "Failed to delete workbook" }, { status: 500 });
  }
}
