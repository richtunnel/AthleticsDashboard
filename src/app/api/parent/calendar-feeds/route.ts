import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * POST /api/parent/calendar-feeds
 * Mark a calendar as subscribed (for tracking purposes).
 *
 * Corrected field names to match the actual ParentAthleteLink schema:
 *   - sport  (not sportName)
 *   - gradeLevel  (not sportLevel)
 *   - status === "ACTIVE"  (not active boolean)
 * And tracks sync via ConnectedParent.lastSyncedAt (not ParentAthleteLink.syncedAt).
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { calendarId, action } = body;

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    // Parse the calendar ID: "schoolId-sportName-level"
    const parts = calendarId.split("-");
    if (parts.length < 3) {
      return NextResponse.json(
        { error: "Invalid calendar ID format" },
        { status: 400 }
      );
    }

    const schoolId = parts[0];
    const level = parts[parts.length - 1];
    const sportName = parts.slice(1, parts.length - 1).join(" ");

    // Verify the parent has a link to this school/sport
    // Uses correct field names: sport, gradeLevel, status
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId,
        sport: { equals: sportName, mode: "insensitive" },
        gradeLevel: { contains: level, mode: "insensitive" },
        status: "ACTIVE",
      },
    });

    if (!parentLink) {
      // Also accept PENDING status as a fallback
      const pendingLink = await prisma.parentAthleteLink.findFirst({
        where: {
          parentUserId: user.id,
          schoolId,
          sport: { equals: sportName, mode: "insensitive" },
          gradeLevel: { contains: level, mode: "insensitive" },
        },
      });

      if (!pendingLink) {
        return NextResponse.json(
          { error: "No subscription found for this calendar" },
          { status: 404 }
        );
      }
    }

    if (action === "subscribe") {
      // Track sync on ConnectedParent (ParentAthleteLink has no syncedAt field)
      await prisma.connectedParent.updateMany({
        where: {
          parentUserId: user.id,
          schoolId,
        },
        data: {
          calendarSynced: true,
          lastSyncedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message:
        action === "subscribe"
          ? "Calendar subscription tracked"
          : "Calendar unsubscribed",
    });
  } catch (error) {
    console.error("[API] Error updating calendar subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
