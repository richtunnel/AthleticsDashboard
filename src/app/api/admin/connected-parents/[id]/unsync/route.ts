import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
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

    // Mark CalendarSyncRequests for this parent as rejected so they stop syncing
    await prisma.calendarSyncRequest.updateMany({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
        status: "APPROVED",
      },
      data: { status: "REJECTED" },
    });

    // Update ConnectedParent to reflect un-synced state
    await prisma.connectedParent.update({
      where: { id },
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
