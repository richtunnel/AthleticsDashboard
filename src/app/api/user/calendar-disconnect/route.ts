// src/app/api/user/calendar-disconnect/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { revokeScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

/**
 * Legacy endpoint for disconnecting Google Calendar.
 * 
 * This endpoint is maintained for backward compatibility.
 * New code should use /api/auth/google-calendar/disconnect instead.
 */
export async function POST() {
  try {
    const session = await requireAuth();

    // Use the same logic as the new disconnect endpoint
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar Disconnect Error:", error);
    return NextResponse.json({ success: false, error: "Failed to disconnect." }, { status: 500 });
  }
}
