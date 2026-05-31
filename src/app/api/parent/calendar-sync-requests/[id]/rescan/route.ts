import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { invalidate } from "@/lib/cache/redisCache";

/**
 * POST /api/parent/calendar-sync-requests/[id]/rescan
 *
 * "Update Sync" — rescans the AD's worksheet for new games matching this
 * child's sport/level/gender. Does NOT touch Google Calendar.
 *
 * Implementation: blow away the parent's overview cache so the next
 * /api/parent/overview call re-reads the AD's workbook from the DB. Any
 * games the AD has added since the last cache populate will surface on the
 * client immediately after the React Query refetch.
 *
 * Response includes a before/after count so the UI can tell the parent
 * how many new games appeared.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({ where: { id: sessionUserId } })
      : await prisma.user.findFirst({
          where: { email: { equals: session.user.email, mode: "insensitive" } },
        });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;

    // ── Verify the sync request belongs to this parent ───────────────────
    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
      select: {
        id: true,
        parentUserId: true,
        status: true,
        schoolId: true,
        sportName: true,
        sportLevel: true,
        workbookId: true,
      },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (syncRequest.parentUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (syncRequest.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved requests can be refreshed" },
        { status: 400 }
      );
    }

    // ── Count games BEFORE invalidating, to report a delta ───────────────
    // Scope to the AD's pinned workbook when available — that's the precise
    // worksheet the parent's child games come from. Falls back to a broader
    // organization+sport scan when no workbook was pinned during approval.
    const futureFilter = { date: { gte: new Date() } } as const;
    const beforeWhere = syncRequest.workbookId
      ? { workbookId: syncRequest.workbookId, ...futureFilter }
      : {
          homeTeam: {
            organizationId: syncRequest.schoolId,
            sport: { name: { equals: syncRequest.sportName, mode: "insensitive" as const } },
            level: { equals: syncRequest.sportLevel, mode: "insensitive" as const },
          },
          ...futureFilter,
        };

    const beforeCount = await prisma.game.count({ where: beforeWhere });

    // ── Invalidate the parent overview cache ─────────────────────────────
    // The dashboard caches /api/parent/overview for 30s under this key. Wipe
    // it so the next client fetch reads fresh data from the DB.
    await invalidate(`parent:overview:${user.id}`).catch((err) => {
      console.error("[parent-rescan] redis invalidate failed:", err);
    });

    // ── Count after — same filter, but with a fresh DB read ──────────────
    // (Game count is a direct DB query, not cached, so this reflects truth.)
    const afterCount = await prisma.game.count({ where: beforeWhere });
    const added = Math.max(0, afterCount - beforeCount);

    return NextResponse.json({
      success: true,
      result: {
        added,
        totalUpcoming: afterCount,
      },
    });
  } catch (error: any) {
    console.error("[API] Error rescanning sync request:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to refresh schedule" },
      { status: 500 }
    );
  }
}
