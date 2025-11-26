import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { organizationScore, opponentScore } = body;

    if (organizationScore === undefined || opponentScore === undefined) {
      return NextResponse.json(
        { success: false, error: "Scores are required" },
        { status: 400 }
      );
    }

    const existingMatchup = await prisma.matchupResult.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingMatchup) {
      return NextResponse.json({ success: false, error: "Matchup result not found" }, { status: 404 });
    }

    const matchupResult = await prisma.matchupResult.update({
      where: { id },
      data: {
        organizationScore: parseInt(organizationScore),
        opponentScore: parseInt(opponentScore),
      },
      include: {
        opponent: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: matchupResult,
    });
  } catch (error) {
    console.error("Error updating matchup result:", error);
    return NextResponse.json({ success: false, error: "Failed to update matchup result" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const matchupResult = await prisma.matchupResult.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!matchupResult) {
      return NextResponse.json({ success: false, error: "Matchup result not found" }, { status: 404 });
    }

    await prisma.matchupResult.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting matchup result:", error);
    return NextResponse.json({ success: false, error: "Failed to delete matchup result" }, { status: 500 });
  }
}
