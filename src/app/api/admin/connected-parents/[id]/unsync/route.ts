import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/admin/connected-parents/[id]/unsync
 * AD removes the calendar sync for a parent (sets calendarSynced=false).
 * Does NOT delete calendar events — simply marks the parent as un-synced
 * so future game updates are no longer pushed to their calendar.
 */
export async function POST(
  _req: NextRequest,
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

    // The frontend identifies rows by CalendarSyncRequest.id (the canonical
    // source — see /api/connected-parents). Look up by that.
    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
      select: {
        id: true,
        parentUserId: true,
        schoolId: true,
        sportName: true,
        sportLevel: true,
        status: true,
      },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Sync request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Unsync THIS specific sport/level. Earlier code was nuking every approved
    // request for the parent at this school, which kills sibling approvals
    // (boys + girls basketball would both get unsynced if either was clicked).
    if (syncRequest.status === "APPROVED") {
      await prisma.calendarSyncRequest.update({
        where: { id: syncRequest.id },
        data: { status: "REMOVED" },
      });
    }

    // Reflect un-synced state on ConnectedParent (keyed by parentUserId, not id).
    await prisma.connectedParent.updateMany({
      where: {
        parentUserId: syncRequest.parentUserId,
        schoolId: syncRequest.schoolId,
      },
      data: { calendarSynced: false },
    });

    return NextResponse.json({ success: true, message: "Calendar sync removed" });
  } catch (error: any) {
    console.error("[API] Error unsyncing connected parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to unsync calendar" },
      { status: 500 }
    );
  }
}
