import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { calendarService } from "@/lib/services/calendar.service";
import { z } from "zod";

const syncSchema = z.object({
  googleCalendarId: z.string().min(1, "Calendar ID is required"),
});

/**
 * POST /api/parent/calendar-sync-requests/[id]/sync
 * Starts the sync process for an approved request
 */
export async function POST(
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

    // Prefer JWT sub (user ID) over email to avoid case-mismatch issues
    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({ where: { id: sessionUserId } })
      : await prisma.user.findFirst({
          where: { email: { equals: session.user.email, mode: "insensitive" } },
        });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { googleCalendarId } = syncSchema.parse(body);

    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
    });

    if (!syncRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (syncRequest.parentUserId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (syncRequest.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved requests can be synced" },
        { status: 400 }
      );
    }

    // Perform the sync
    const results = await calendarService.syncGamesForSportLevel(
      user.id,
      syncRequest.schoolId,
      syncRequest.sportName,
      syncRequest.sportLevel,
      googleCalendarId
    );

    // Persist the target calendar ID so the trigger service knows where to
    // push future games that match this parent's sport/level subscription
    await prisma.calendarSyncRequest.update({
      where: { id },
      data: { googleCalendarId },
    });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error syncing calendar:", error);
    return NextResponse.json(
      { error: "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
