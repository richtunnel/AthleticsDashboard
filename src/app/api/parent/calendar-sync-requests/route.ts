import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { publishChatEvent } from "@/lib/chat/eventBus";
import { parseSportLabel } from "@/lib/utils/sportMatch";
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
    //
    // Try exact match first, then fall back to base-sport matching so display
    // names ("Boys Basketball") and raw API names ("Basketball") both resolve
    // correctly against whatever was stored in the ParentAthleteLink.
    const { baseSport } = parseSportLabel(validatedData.sportName);
    const sportClauses = [
      { sport: { equals: validatedData.sportName, mode: "insensitive" as const } },
      ...(baseSport && baseSport.toLowerCase() !== validatedData.sportName.toLowerCase()
        ? [{ sport: { equals: baseSport, mode: "insensitive" as const } }]
        : []),
    ];

    const link = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        OR: sportClauses,
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

    // Look up any prior request for this exact slot. The status decides what
    // happens next:
    //   PENDING  → block, the AD already has it in their queue
    //   APPROVED → block, sync is already active
    //   REMOVED  → resurrect (parent previously unsynced; restore approval)
    //   REJECTED → fall through (clear it and create a fresh PENDING)
    const existing = await prisma.calendarSyncRequest.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sportName: { equals: validatedData.sportName, mode: "insensitive" },
        sportLevel: { equals: validatedData.sportLevel, mode: "insensitive" },
        status: { in: ["PENDING", "APPROVED", "REMOVED"] },
      },
    });

    if (existing && existing.status === "APPROVED") {
      return NextResponse.json(
        { error: "Calendar sync is already active for this sport and level" },
        { status: 400 }
      );
    }

    if (existing && existing.status === "PENDING") {
      return NextResponse.json(
        {
          error:
            "You already have a pending request for this sport and level. Please wait for the athletic director to review it.",
        },
        { status: 400 }
      );
    }

    // ── Resurrect a previously-unsynced row ──────────────────────────────
    // The AD already approved this slot once; the parent shouldn't have to
    // wait for a fresh approval. Bump it straight back to APPROVED and we're
    // done — googleCalendarId / workbookId / gender are still on the row
    // from the original approval.
    let syncRequest;
    if (existing && existing.status === "REMOVED") {
      syncRequest = await prisma.calendarSyncRequest.update({
        where: { id: existing.id },
        data: {
          status: "APPROVED",
          // Reset rejection trail just in case it was reused
          rejectionReason: null,
        },
      });

      // Mirror on ConnectedParent so the AD's view shows the parent as synced again.
      await prisma.connectedParent
        .updateMany({
          where: { parentUserId: user.id, schoolId: validatedData.schoolId },
          data: { calendarSynced: true },
        })
        .catch((err) => {
          console.warn("[resync] failed to mirror ConnectedParent.calendarSynced:", err);
        });
    } else {
      syncRequest = await prisma.calendarSyncRequest.create({
        data: {
          parentUserId: user.id,
          schoolId: validatedData.schoolId,
          sportName: validatedData.sportName,
          sportLevel: validatedData.sportLevel,
        },
      });
    }

    // Invalidate the parent's dashboard cache so the new request shows immediately
    const { invalidate } = await import("@/lib/cache/redisCache");
    void invalidate(`parent:overview:${user.id}`);

    // Notify ADs via Redis Pub/Sub. Distinguish a brand-new approval request
    // (needs AD attention) from a resumed sync (already approved — informational).
    const isResume = existing?.status === "REMOVED";
    void publishChatEvent(`sync:${validatedData.schoolId}`, {
      type: isResume ? "sync_request_updated" : "sync_request",
      requestId: syncRequest.id,
      parentName: user.name || user.email || "A parent",
      sportName: validatedData.sportName,
      sportLevel: validatedData.sportLevel,
      requestedAt: syncRequest.requestedAt.toISOString(),
      ...(isResume ? { status: "APPROVED" as const } : {}),
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
