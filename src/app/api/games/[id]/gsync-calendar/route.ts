import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { syncGameToCalendar } from "@/lib/google/google-calendar-sync";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // ✅ VALIDATE: Game belongs to user's organization
    const game = await prisma.game.findFirst({
      where: {
        id,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!game) {
      return NextResponse.json({ success: false, error: "Game not found or unauthorized" }, { status: 404 });
    }

    // Call the core sync logic
    const event = await syncGameToCalendar(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Game synced to Google Calendar.",
      data: {
        eventId: event.id,
        htmlLink: event.htmlLink,
      },
    });
  } catch (error: any) {
    console.error("Manual Sync Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync game.",
      },
      { status: 500 }
    );
  }
}
