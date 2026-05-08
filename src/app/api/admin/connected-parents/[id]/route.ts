import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

/**
 * DELETE /api/admin/connected-parents/[id]
 * AD removes a parent connection entirely.
 * Deletes: ConnectedParent, related CalendarSyncRequests, and the ParentAthleteLink.
 */
export async function DELETE(
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

    // Remove related CalendarSyncRequests for this parent+school combination
    await prisma.calendarSyncRequest.deleteMany({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
      },
    });

    // Remove related ParentAthleteLink(s) for this parent at this school
    await prisma.parentAthleteLink.deleteMany({
      where: {
        parentUserId: connectedParent.parentUserId,
        schoolId: connectedParent.schoolId,
      },
    });

    // Finally remove the ConnectedParent record
    await prisma.connectedParent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Parent connection removed" });
  } catch (error: any) {
    console.error("[API] Error removing connected parent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove parent connection" },
      { status: 500 }
    );
  }
}
