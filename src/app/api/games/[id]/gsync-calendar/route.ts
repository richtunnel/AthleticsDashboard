import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { syncGameToCalendar, unsyncGameFromCalendar } from "@/lib/google/google-calendar-sync";
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
    const result = await syncGameToCalendar(id, session.user.id);

    // Check if calendar sync was skipped due to not being connected
    if ('skipped' in result && result.skipped) {
      return NextResponse.json({
        success: false,
        skipped: true,
        error: 'message' in result ? result.message : "Google Calendar not connected",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Game synced to Google Calendar.",
      data: {
        eventId: result.id,
        htmlLink: result.htmlLink,
      },
    });
  } catch (error: any) {
    console.error("Manual Sync Error:", error);

    // Scope error — tell the frontend to prompt the user to reconnect their calendar.
    if (error?.code === "INSUFFICIENT_SCOPE") {
      return NextResponse.json(
        { success: false, needsReauth: true, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync game." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    // Call the unsync logic
    const result = await unsyncGameFromCalendar(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Game removed from Google Calendar.",
    });
  } catch (error: any) {
    console.error("Manual Unsync Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to remove game from calendar.",
      },
      { status: 500 }
    );
  }
}
