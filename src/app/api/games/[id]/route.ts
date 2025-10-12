import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Separate custom data from regular fields
    const { customData, ...regularData } = body;

    const updateData: any = { ...regularData };

    // Handle custom data separately
    if (customData !== undefined) {
      const existingGame = await prisma.game.findUnique({
        where: { id },
        select: { customData: true },
      });

      const existingCustomData = (existingGame?.customData as any) || {};
      updateData.customData = { ...existingCustomData, ...customData };
    }

    const game = await prisma.game.update({
      where: { id },
      data: updateData,
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    return NextResponse.json(game);
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await prisma.game.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting game:", error);
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }
}
