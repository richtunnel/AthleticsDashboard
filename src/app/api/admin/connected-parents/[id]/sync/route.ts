import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { calendarService } from "@/lib/services/calendar.service";

/**
 * POST /api/admin/connected-parents/[id]/sync
 * AD triggers a calendar re-sync for a specific connected parent.
 * The sync runs against the parent's Google Calendar using their stored tokens.
 */
export async function POST(
  _req: NextRequest,
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

    // Ensure the parent belongs to this AD's school
    if (connectedParent.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!connectedParent.sportName || !connectedParent.sportLevel) {
      return NextResponse.json(
        { error: "Parent has no sport/level configured — cannot sync" },
        { status: 400 }
      );
    }

    // Run sync on behalf of the parent (uses parent's Google tokens)
    const results = await calendarService.syncGamesForSportLevel(
      connectedParent.parentUserId,
      connectedParent.schoolId,
      connectedParent.sportName,
      connectedParent.sportLevel,
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
      message: `Sync complete — ${synced} game(s) synced, ${failed} failed`,
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
