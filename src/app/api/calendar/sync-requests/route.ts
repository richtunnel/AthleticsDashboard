import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/calendar/sync-requests
 * Returns all calendar sync requests for the AD's organization
 */
export async function GET(request: NextRequest) {
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

    const requests = await prisma.calendarSyncRequest.findMany({
      where: { schoolId: user.organizationId },
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
