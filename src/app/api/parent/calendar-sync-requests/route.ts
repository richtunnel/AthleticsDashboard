import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { z } from "zod";

const requestSchema = z.object({
  sportName: z.string().min(1, "Sport is required"),
  sportLevel: z.string().min(1, "Level is required"),
  schoolId: z.string().min(1, "School ID is required"),
});

/**
 * GET /api/parent/calendar-sync-requests
 * Returns calendar sync requests for the current parent
 */
export async function GET(request: NextRequest) {
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

    const requests = await prisma.calendarSyncRequest.findMany({
      where: { parentUserId: user.id },
      include: {
        school: {
          select: {
            name: true,
          }
        }
      },
      orderBy: { requestedAt: "desc" },
    });

    return NextResponse.json({
      requests: requests.map(r => ({
        ...r,
        requestedAt: r.requestedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching calendar sync requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parent/calendar-sync-requests
 * Creates a new calendar sync request
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
    const validatedData = requestSchema.parse(body);

    // Verify parent is linked to this school
    const link = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
      }
    });

    if (!link) {
      return NextResponse.json(
        { error: "You are not linked to this school" },
        { status: 403 }
      );
    }

    // Check for existing request for same sport/level
    const existing = await prisma.calendarSyncRequest.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: `You already have a ${existing.status.toLowerCase()} request for this sport and level` },
        { status: 400 }
      );
    }

    const syncRequest = await prisma.calendarSyncRequest.create({
      data: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
      }
    });

    return NextResponse.json({
      request: {
        ...syncRequest,
        requestedAt: syncRequest.requestedAt.toISOString(),
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error creating calendar sync request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
