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

    const connectedParent = await prisma.connectedParent.findUnique({
      where: { id },
    });

    if (!connectedParent) {
      return NextResponse.json({ error: "Connected parent not found" }, { status: 404 });
    }

    if (connectedParent.schoolId !== adUser.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Mark all CalendarSyncRequests for this parent+school as REMOVED
    await prisma.calendarSyncRequest.updateMany({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
      },
      data: { status: "REMOVED" },
    });

    // Remove the ConnectedParent record — ParentAthleteLink is intentionally kept
    // so the parent still sees their child's card and can re-request sync.
    await prisma.connectedParent.delete({
      where: { id },
    });

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
