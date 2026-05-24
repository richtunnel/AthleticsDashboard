import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { z } from "zod";

const approveSchema = z.object({
  googleCalendarId: z.string().optional(),
  // AD can override / confirm the gender ("boys", "girls", "mixed") and point
  // to a specific Google Sheet that holds this sport's schedule.
  gender: z.string().max(20).optional().nullable(),
  spreadsheetId: z.string().max(200).optional().nullable(),
});

/**
 * POST /api/admin/calendar-sync-requests/[id]/approve
 * Approves a calendar sync request
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
    const { googleCalendarId, gender, spreadsheetId } = approveSchema.parse(body);

    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
    });

    if (!syncRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (syncRequest.schoolId !== user.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Normalise gender to canonical form so matching works regardless of how the
    // AD typed it ("F", "female", "Girls" all become "girls").
    const { CalendarService } = await import("@/lib/services/calendar.service");
    const normalisedGender = gender
      ? CalendarService.normaliseGender(gender)
      : undefined;

    // Extract sheet ID from a full Google Sheets URL if the AD pasted one
    const normalisedSheetId = spreadsheetId
      ? (spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? spreadsheetId.trim()) || null
      : null;

    const updatedRequest = await prisma.calendarSyncRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: user.id,
        ...(normalisedGender !== undefined ? { gender: normalisedGender } : {}),
        ...(normalisedSheetId !== undefined ? { spreadsheetId: normalisedSheetId } : {}),
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
        { error: error.issues[0].message },
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
