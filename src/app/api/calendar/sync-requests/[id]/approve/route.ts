import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

const approveSchema = z.object({
  googleCalendarId: z.string().min(1, "Calendar ID is required"),
});

/**
 * POST /api/calendar/sync-requests/[id]/approve
 * Approves a calendar sync request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();
    const { googleCalendarId } = approveSchema.parse(body);

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
        status: "APPROVED",
        googleCalendarId,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    });

    // Also update ConnectedParent if it exists for this parent/school
    const connectedParent = await prisma.connectedParent.findFirst({
        where: {
            parentUserId: syncRequest.parentUserId,
            schoolId: syncRequest.schoolId,
        }
    });

    if (connectedParent) {
        await prisma.connectedParent.update({
            where: { id: connectedParent.id },
            data: {
                calendarSynced: true,
                sportName: syncRequest.sportName,
                sportLevel: syncRequest.sportLevel,
            }
        });
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
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error approving calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to approve request" },
      { status: 500 }
    );
  }
}
