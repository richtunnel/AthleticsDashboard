import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { publishChatEvent } from "@/lib/chat/eventBus";
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
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({ where: { id: sessionUserId } })
      : await prisma.user.findFirst({ where: { email: { equals: session.user.email, mode: "insensitive" } } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({ where: { id: sessionUserId } })
      : await prisma.user.findFirst({ where: { email: { equals: session.user.email, mode: "insensitive" } } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // Verify parent is linked to this school AND that the link's sport/level
    // match what's being requested. This prevents creating a sync request for
    // a sport the parent hasn't actually told us their child plays.
    const link = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sport: { equals: validatedData.sportName, mode: "insensitive" },
        gradeLevel: { equals: validatedData.sportLevel, mode: "insensitive" },
      },
    });

    if (!link) {
      return NextResponse.json(
        {
          error:
            "No matching child found. Make sure you've added your child with this exact sport and level in Settings first.",
        },
        { status: 400 }
      );
    }

    // Enforce single-pending rule: block if an active (PENDING or APPROVED) request
    // already exists for this exact school + sport + level combination.
    // REJECTED requests are allowed to be re-requested — that's the re-sync flow.
    const existing = await prisma.calendarSyncRequest.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sportName: { equals: validatedData.sportName, mode: "insensitive" },
        sportLevel: { equals: validatedData.sportLevel, mode: "insensitive" },
        status: { in: ["PENDING", "APPROVED"] },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.status === "APPROVED"
              ? "Calendar sync is already active for this sport and level"
              : "You already have a pending request for this sport and level. Please wait for the athletic director to review it.",
        },
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

    // Invalidate the parent's dashboard cache so the new request shows immediately
    const { invalidate } = await import("@/lib/cache/redisCache");
    void invalidate(`parent:overview:${user.id}`);

    // Notify ADs via Redis Pub/Sub — uses dedicated sync channel so the
    // notifications SSE can distinguish sync requests from chat messages
    void publishChatEvent(`sync:${validatedData.schoolId}`, {
      type: "sync_request",
      requestId: syncRequest.id,
      parentName: user.name || user.email || "A parent",
      sportName: validatedData.sportName,
      sportLevel: validatedData.sportLevel,
      requestedAt: syncRequest.requestedAt.toISOString(),
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
