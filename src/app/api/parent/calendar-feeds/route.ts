import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * POST /api/parent/calendar-feeds
 * Mark a calendar as subscribed (for tracking purposes)
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

    // Parse the calendar ID to get school/sport/level info
    // Format: schoolId-sportName-level
    const parts = calendarId.split('-');
    if (parts.length < 3) {
      return NextResponse.json(
        { error: "Invalid calendar ID format" },
        { status: 400 }
      );
    }

    // The first part is the schoolId, the last part is level, middle is sport
    const schoolId = parts[0];
    const level = parts[parts.length - 1];
    const sportName = parts.slice(1, parts.length - 1).join(' ');

    // Check if parent has a link to this school/sport/level
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: schoolId,
        sportName: { equals: sportName, mode: 'insensitive' },
        sportLevel: { contains: level, mode: 'insensitive' },
        active: true,
      },
    });

    if (!parentLink) {
      return NextResponse.json(
        { error: "No subscription found for this calendar" },
        { status: 404 }
      );
    }

    // Update the calendar subscription status
    if (action === 'subscribe') {
      // Update ConnectedParent if exists
      await prisma.connectedParent.updateMany({
        where: {
          parentUserId: user.id,
          schoolId: schoolId,
        },
        data: {
          calendarSynced: true,
        },
      });

      // Update ParentAthleteLink
      await prisma.parentAthleteLink.update({
        where: { id: parentLink.id },
        data: {
          syncedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: action === 'subscribe' ? 'Calendar subscription tracked' : 'Calendar unsubscribed',
    });
  } catch (error) {
    console.error("[API] Error updating calendar subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
