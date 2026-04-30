import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * DELETE /api/parent/calendar-sync-requests/[id]
 * Cancels a pending calendar sync request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getParentSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { id } = params;

    // Verify ownership and status
    const syncRequest = await prisma.calendarSyncRequest.findFirst({
      where: {
        id,
        parentUserId: user.id,
      },
    });

    if (!syncRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (syncRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending requests can be cancelled" },
        { status: 400 }
      );
    }

    await prisma.calendarSyncRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error cancelling calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to cancel request" },
      { status: 500 }
    );
  }
}
