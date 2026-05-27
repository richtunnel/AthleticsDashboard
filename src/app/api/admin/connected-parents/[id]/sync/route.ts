import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
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
    const session = await getAnySession();
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

    // The /api/connected-parents endpoint uses CalendarSyncRequest.id as the
    // row identifier (it's the canonical source of truth for "who's connected").
    // Look up by that ID — NOT by ConnectedParent.id — so the IDs the frontend
    // sees actually resolve.
    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
      select: {
        id: true,
        parentUserId: true,
        schoolId: true,
        sportName: true,
        sportLevel: true,
        workbookId: true,
        gender: true,
        status: true,
      },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Sync request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Body may supply sport/level overrides from the sync dialog
    const body = await req.json().catch(() => ({}));
    const sportName: string | null = body.sportName || syncRequest.sportName || null;
    const sportLevel: string | null = body.sportLevel || syncRequest.sportLevel || null;

    if (!sportName || !sportLevel) {
      return NextResponse.json(
        {
          error:
            "Please select a sport and level to sync. Use the Sync button and choose the appropriate options.",
        },
        { status: 400 }
      );
    }

    // If the AD edited sport/level in the dialog, persist that on the sync request
    // so subsequent rescans use the corrected values.
    if (
      sportName !== syncRequest.sportName ||
      sportLevel !== syncRequest.sportLevel
    ) {
      await prisma.calendarSyncRequest.update({
        where: { id: syncRequest.id },
        data: { sportName, sportLevel },
      });
    }

    // Shim object so the rest of this route can keep using the prior var names.
    const connectedParent = {
      id: syncRequest.id,
      parentUserId: syncRequest.parentUserId,
      schoolId: syncRequest.schoolId,
    };

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

    // Clear any stuck syncInProgress locks from previous failed attempts so
    // games aren't silently skipped on retry.
    await prisma.game.updateMany({
      where: { homeTeam: { organizationId: connectedParent.schoolId }, syncInProgress: true },
      data: { syncInProgress: false },
    });

    // Ensure an APPROVED CalendarSyncRequest exists for this sport/level.
    // syncGameToCalendar runs a PARENT permission check that requires one —
    // without it the sync fails even though the AD explicitly authorized it.
    const existingRequest = await prisma.calendarSyncRequest.findFirst({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
        sportName,
        sportLevel,
      },
    });
    if (existingRequest) {
      if (existingRequest.status !== "APPROVED") {
        await prisma.calendarSyncRequest.update({
          where: { id: existingRequest.id },
          data: { status: "APPROVED" },
        });
      }
    } else {
      await prisma.calendarSyncRequest.create({
        data: {
          parentUserId: connectedParent.parentUserId,
          schoolId: connectedParent.schoolId,
          sportName,
          sportLevel,
          status: "APPROVED",
        },
      });
    }

    // Run sync — uses the parent's own OAuth tokens.
    // Pass workbookId + gender from the SyncRequest so the team-match query
    // can distinguish Boys vs Girls of the same sport, and so we scan only
    // the worksheet the AD pinned during approval (no cross-sport bleed).
    const results = await calendarService.syncGamesForSportLevel(
      connectedParent.parentUserId,
      connectedParent.schoolId,
      sportName,
      sportLevel,
      "primary",
      syncRequest.workbookId ?? null,
      syncRequest.gender ?? null
    );

    // Mark as synced — keyed by parentUserId since the route's `id` is a
    // CalendarSyncRequest.id, not a ConnectedParent.id.
    await prisma.connectedParent.updateMany({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
      },
      data: { calendarSynced: true, lastSyncedAt: new Date() },
    });

    const synced = results.filter((r: any) => r.ok).length;
    const failedResults = results.filter((r: any) => !r.ok);
    const failed = failedResults.length;
    const errors = failedResults.map((r: any) => r.error).filter(Boolean);

    return NextResponse.json({
      success: true,
      message: `Sync complete — ${synced} game(s) added to calendar, ${failed} failed`,
      synced,
      failed,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    console.error("[API] Error syncing connected parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
