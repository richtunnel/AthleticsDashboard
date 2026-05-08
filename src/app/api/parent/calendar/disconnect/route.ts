import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { revokeScopes } from "@/lib/services/incremental-auth.service";

/**
 * POST /api/parent/calendar/disconnect
 *
 * Disconnects Google Calendar for the parent user.
 * Uses ONLY the parent session — never the AD session.
 */
export async function POST() {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const revoked = await revokeScopes(user.id, "CALENDAR");

    if (!revoked) {
      // Legacy token fallback
      await prisma.user.update({
        where: { id: user.id },
        data: {
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          calendarTokenExpiry: null,
          googleCalendarId: null,
          googleCalendarEmail: null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error disconnecting parent calendar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
