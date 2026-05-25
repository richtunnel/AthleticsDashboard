import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

const rejectSchema = z.object({
  reason: z.string().min(1, "Reason is required"),
});

/**
 * POST /api/admin/calendar-sync-requests/[id]/reject
 * Rejects a calendar sync request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = rejectSchema.parse(body);

    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedRequest = await prisma.calendarSyncRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    });

    // Real-time push to all AD tabs so the rejected row disappears immediately
    try {
      const { publishChatEvent } = await import("@/lib/chat/eventBus");
      void publishChatEvent(`sync:${syncRequest.schoolId}`, {
        type: "sync_request_updated",
        requestId: syncRequest.id,
        status: "REJECTED",
      });
    } catch (err) {
      console.warn("[reject] failed to publish sync event:", err);
    }

    return NextResponse.json({
      request: {
        ...updatedRequest,
        reviewedAt: updatedRequest.reviewedAt?.toISOString(),
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error rejecting calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to reject request" },
      { status: 500 }
    );
  }
}
