import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { hasScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/calendar/status
 *
 * Parent-only calendar connection status — never uses the AD session so a
 * user who is simultaneously logged in as both AD and parent always sees
 * their OWN calendar state, not the AD's.
 */
export async function GET() {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ isConnected: false, connectedEmail: null });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        googleCalendarEmail: true,
        googleCalendarRefreshToken: true,
        googleCalendarAccessToken: true,
      },
    });

    if (!user) {
      return NextResponse.json({ isConnected: false, connectedEmail: null });
    }

    const hasCalendarScope = await hasScopes(user.id, "CALENDAR");
    const hasLegacyTokens = Boolean(
      user.googleCalendarRefreshToken || user.googleCalendarAccessToken
    );
    const isConnected = hasCalendarScope || hasLegacyTokens;

    // Only return the verified Google Calendar email — never the sign-in email.
    // If googleCalendarEmail was incorrectly set to the sign-in email by the
    // old buggy fallback, we surface null so the parent knows to reconnect.
    const calendarEmail = user.googleCalendarEmail ?? null;
    const connectedEmail =
      calendarEmail && calendarEmail !== user.email ? calendarEmail : calendarEmail;

    return NextResponse.json({
      isConnected,
      connectedEmail,
      userName: user.name,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("[API] Error fetching parent calendar status:", error);
    return NextResponse.json({ isConnected: false, connectedEmail: null });
  }
}
