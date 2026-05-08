import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";

/**
 * POST /api/admin/connected-parents/[id]/sync
 *
 * AD triggers a calendar sync for a connected parent.
 * The sync pushes games that match the chosen sport/level from the AD's school
 * to the parent's Google Calendar using their stored OAuth tokens.
 *
 * Body (optional):
 *   sportName  – overrides the sport stored on ConnectedParent
 *   sportLevel – overrides the level stored on ConnectedParent
 *
 * If the body omits sport/level, the values stored on the ConnectedParent
 * record are used. If neither source has values, the request is rejected with
 * a clear error so the AD knows to pick a sport/level in the dialog.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const adUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true, organizationId: true },
    });

    if (!adUser || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD"].includes(adUser.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const connectedParent = await prisma.connectedParent.findUnique({
      where: { id },
    });

    if (!connectedParent) {
      return NextResponse.json({ error: "Connected parent not found" }, { status: 404 });
    }

    if (connectedParent.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Body may supply sport/level overrides from the sync dialog
    const body = await req.json().catch(() => ({}));
    const sportName: string | null = body.sportName || connectedParent.sportName || null;
    const sportLevel: string | null = body.sportLevel || connectedParent.sportLevel || null;

    if (!sportName || !sportLevel) {
      return NextResponse.json(
        {
          error:
            "Please select a sport and level to sync. Use the Sync button and choose the appropriate options.",
        },
        { status: 400 }
      );
    }

    // Persist the chosen sport/level on the ConnectedParent record so future
    // syncs can default to the same values.
    if (sportName !== connectedParent.sportName || sportLevel !== connectedParent.sportLevel) {
      await prisma.connectedParent.update({
        where: { id },
        data: { sportName, sportLevel },
      });
    }

    // Verify the parent has connected their Google Calendar.
    // Check both the Account record (incremental OAuth) and the legacy
    // User-level token fields.
    const [parentAccount, parentUser] = await Promise.all([
      prisma.account.findFirst({
        where: { userId: connectedParent.parentUserId, provider: "google" },
        select: { scope: true, refresh_token: true, access_token: true },
      }),
      prisma.user.findUnique({
        where: { id: connectedParent.parentUserId },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
        },
      }),
    ]);

    const hasAccountTokens = !!(parentAccount?.refresh_token || parentAccount?.access_token);
    const hasLegacyTokens = !!(
      parentUser?.googleCalendarRefreshToken || parentUser?.googleCalendarAccessToken
    );
    const hasCalendarScope =
      hasLegacyTokens ||
      (parentAccount?.scope
        ? parentAccount.scope.split(" ").some((s) => s.includes("calendar"))
        : false);

    if ((!hasAccountTokens && !hasLegacyTokens) || !hasCalendarScope) {
      return NextResponse.json(
        {
          error:
            "This parent hasn't connected their Google Calendar yet. Ask them to visit the Calendar page in their parent dashboard and click 'Connect Google Calendar'.",
        },
        { status: 400 }
      );
    }

    // Run sync — uses the parent's own OAuth tokens
    const results = await calendarService.syncGamesForSportLevel(
      connectedParent.parentUserId,
      connectedParent.schoolId,
      sportName,
      sportLevel,
      "primary"
    );

    // Mark as synced
    await prisma.connectedParent.update({
      where: { id },
      data: { calendarSynced: true, lastSyncedAt: new Date() },
    });

    const synced = results.filter((r: any) => r.ok).length;
    const failed = results.filter((r: any) => !r.ok).length;

    return NextResponse.json({
      success: true,
      message: `Sync complete — ${synced} game(s) added to calendar, ${failed} failed`,
      synced,
      failed,
    });
  } catch (error: any) {
    console.error("[API] Error syncing connected parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
