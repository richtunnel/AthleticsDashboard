import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/admin/calendar-sync-requests
 * Returns all calendar sync requests for the AD's organization
 */
export async function GET(request: NextRequest) {
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

    // REMOVED rows are parent-side "unsync" tombstones used to skip the
    // re-approval step on resync. The AD's lists shouldn't surface them.
    const requests = await prisma.calendarSyncRequest.findMany({
      where: { schoolId: user.organizationId, status: { not: "REMOVED" } },
      include: {
        parent: {
          select: {
            name: true,
            email: true,
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
