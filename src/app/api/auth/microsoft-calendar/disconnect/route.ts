import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { revokeScopes } from "@/lib/microsoft/incremental-auth.service";
import { revokeMicrosoftTokens } from "@/lib/microsoft/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/auth/microsoft-calendar/disconnect
 *
 * Disconnects Microsoft Calendar by revoking calendar scopes and clearing tokens
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Revoke calendar scopes from the account
    await revokeScopes(session.user.id, "CALENDAR");

    // Clear calendar-specific tokens from user record
    await revokeMicrosoftTokens(session.user.id);

    // Also clear any Microsoft calendar events from games
    await prisma.game.updateMany({
      where: {
        createdBy: { id: session.user.id },
        microsoftCalendarEventId: { not: null },
      },
      data: {
        microsoftCalendarEventId: null,
        microsoftCalendarWebLink: null,
        calendarSynced: false,
        lastSyncedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Microsoft Calendar disconnected successfully",
    });
  } catch (error) {
    console.error("[API] Error disconnecting Microsoft calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
