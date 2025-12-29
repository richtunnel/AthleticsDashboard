import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { hasScopes, getGrantedScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/auth/google-calendar/status
 *
 * Checks if user has granted Google Calendar permissions.
 *
 * Note: Some parts of the app still connect Google Calendar via the legacy
 * /api/auth/calendar-connect + /api/auth/calendar-callback flow (which stores
 * tokens on the User record). To keep UI state consistent, we treat either:
 * - incremental auth scopes OR
 * - legacy stored calendar tokens
 * as a connected calendar.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Primary (incremental OAuth) check: Account scopes
    const hasCalendarScope = await hasScopes(session.user.id, "CALENDAR");

    // Legacy check: User table tokens (used by google-calendar-sync.ts)
    const userTokens = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleCalendarRefreshToken: true,
        googleCalendarAccessToken: true,
      },
    });

    const hasLegacyTokens = Boolean(userTokens?.googleCalendarRefreshToken || userTokens?.googleCalendarAccessToken);

    const grantedScopes = await getGrantedScopes(session.user.id);

    // If legacy tokens exist but scopes aren't recorded on the Account, still
    // surface calendar.events as granted so the UI can behave consistently.
    const normalizedScopes = hasLegacyTokens && !grantedScopes.includes("https://www.googleapis.com/auth/calendar.events")
      ? [...grantedScopes, "https://www.googleapis.com/auth/calendar.events"]
      : grantedScopes;

    return NextResponse.json({
      success: true,
      connected: hasCalendarScope || hasLegacyTokens,
      scopes: normalizedScopes,
    });
  } catch (error) {
    console.error("[API] Error checking calendar status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
