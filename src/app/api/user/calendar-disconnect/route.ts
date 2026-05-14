// src/app/api/user/calendar-disconnect/route.ts
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * Disconnect Google Calendar and clear all tokens.
 * This forces the user to go through the OAuth flow again with fresh scopes.
 */
export async function POST() {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔌 Disconnecting calendar for user:", session.user.email);

    // Clear both Account tokens (incremental auth) and User tokens (legacy)
    await Promise.all([
      // Update Account table - clear scope to force re-authorization with new scopes
      prisma.account.updateMany({
        where: {
          userId: session.user.id,
          provider: "google",
        },
        data: {
          scope: null, // Clear scopes to force re-authorization with new scopes
          access_token: null,
          refresh_token: null,
          expires_at: null,
        },
      }),
      // Clear User table tokens (legacy system)
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          googleCalendarRefreshToken: null,
          googleCalendarAccessToken: null,
          googleCalendarEmail: null,
          calendarTokenExpiry: null,
          googleCalendarId: null,
        },
      }),
    ]);

    console.log("✅ Calendar disconnected successfully");

    return NextResponse.json({
      success: true,
      message: "Calendar disconnected successfully. Please reconnect to grant access.",
    });
  } catch (error) {
    console.error("❌ Error disconnecting calendar:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}
