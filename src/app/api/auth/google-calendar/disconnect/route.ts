import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { revokeScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/auth/google-calendar/disconnect
 *
 * Disconnects Google Calendar.
 *
 * We try to revoke incremental auth scopes (Account.scope). If the user doesn't
 * have a linked Google Account record (legacy calendar-only connection), we
 * still clear the stored calendar tokens on the User record so the UI and sync
 * logic are consistent.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Revoke Calendar scopes (incremental auth)
    const revoked = await revokeScopes(session.user.id, "CALENDAR");

    if (!revoked) {
      // Legacy fallback: clear stored tokens so status endpoints flip to disconnected
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          calendarTokenExpiry: null,
          googleCalendarId: null,
          googleCalendarEmail: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Google Calendar disconnected successfully",
    });
  } catch (error) {
    console.error("[API] Error disconnecting calendar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
