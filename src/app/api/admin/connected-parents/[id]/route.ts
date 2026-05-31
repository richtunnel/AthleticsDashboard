import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * DELETE /api/admin/connected-parents/[id]
 * AD removes a parent from calendar sync.
 * Marks existing CalendarSyncRequests as REMOVED and deletes the ConnectedParent
 * record, but intentionally preserves the ParentAthleteLink so the parent can
 * still see their child's card and submit a new re-sync request.
 */
export async function DELETE(
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

    // The frontend identifies rows by CalendarSyncRequest.id. Look up by that.
    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
      select: { id: true, parentUserId: true, schoolId: true },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Sync request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Remove ONLY this specific sport/level approval. Bulk-updating every
    // request for the parent would nuke sibling approvals (boys + girls of
    // the same family), which is almost never what the AD wants from a
    // per-card Remove button.
    await prisma.calendarSyncRequest.update({
      where: { id: syncRequest.id },
      data: { status: "REMOVED" },
    });

    // If this was the parent's last APPROVED request at this school, also
    // drop the ConnectedParent helper row so the AD's Connected Parents tab
    // hides them cleanly. Otherwise leave it (other approvals still active).
    const remaining = await prisma.calendarSyncRequest.count({
      where: {
        parentUserId: syncRequest.parentUserId,
        schoolId: syncRequest.schoolId,
        status: "APPROVED",
      },
    });
    if (remaining === 0) {
      await prisma.connectedParent
        .deleteMany({
          where: {
            parentUserId: syncRequest.parentUserId,
            schoolId: syncRequest.schoolId,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: "Parent removed from calendar sync. Their connection remains active and they can re-request sync.",
    });
  } catch (error: any) {
    console.error("[API] Error removing connected parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove parent connection" },
      { status: 500 }
    );
  }
}
