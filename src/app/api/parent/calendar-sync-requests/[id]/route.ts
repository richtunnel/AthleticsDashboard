import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * DELETE /api/parent/calendar-sync-requests/[id]
 *
 * - PENDING request → "cancel"  (parent gave up waiting for AD approval)
 * - APPROVED request → "unsync" (parent wants to stop syncing this sport,
 *                                or wants to restart the approval flow)
 * - REJECTED request → just delete the history row
 *
 * In all three cases the row is removed so the parent can re-request from
 * scratch. We also wipe matching games from their Google Calendar in a
 * best-effort fashion (non-blocking) when applicable.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Verify ownership
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

    const wasApproved = syncRequest.status === "APPROVED";
    const previousSchoolId = syncRequest.schoolId;

    // ── Allowed actions ──────────────────────────────────────────────────
    // APPROVED → "Unsync": soft-delete (status=REMOVED) so a future resync
    //            doesn't require fresh AD approval.
    // PENDING  → BLOCKED. Parents cannot cancel a pending request — once
    //            submitted, only the AD can resolve it (approve / reject).
    // REJECTED → hard delete (clears history so the parent can retry).
    if (syncRequest.status === "PENDING") {
      return NextResponse.json(
        {
          error:
            "Pending requests can't be cancelled. The athletic director will approve or reject this request shortly.",
        },
        { status: 400 }
      );
    }

    if (wasApproved) {
      await prisma.calendarSyncRequest.update({
        where: { id },
        data: { status: "REMOVED" },
      });
    } else {
      await prisma.calendarSyncRequest.delete({
        where: { id },
      });
    }

    // If we were synced, also drop the calendarSynced flag on ConnectedParent
    // so the AD's "Connected Parents" tab reflects reality.
    if (wasApproved) {
      try {
        await prisma.connectedParent.updateMany({
          where: { parentUserId: user.id, schoolId: previousSchoolId },
          data: { calendarSynced: false },
        });
      } catch (err) {
        console.warn("[unsync] failed to clear ConnectedParent.calendarSynced:", err);
      }
    }

    // Invalidate the parent's cached dashboard so the change shows immediately
    try {
      const { invalidate } = await import("@/lib/cache/redisCache");
      void invalidate(`parent:overview:${user.id}`);
    } catch { /* ignore */ }

    // Push a real-time event to every AD tab so their lists update without polling
    try {
      const { publishChatEvent } = await import("@/lib/chat/eventBus");
      void publishChatEvent(`sync:${previousSchoolId}`, {
        type: "sync_request_updated",
        requestId: id,
        status: wasApproved ? "UNSYNCED" : "CANCELLED",
      });
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, wasApproved });
  } catch (error) {
    console.error("[API] Error cancelling calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to cancel request" },
      { status: 500 }
    );
  }
}
