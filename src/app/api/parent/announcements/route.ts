import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getParentSession } from "@/lib/utils/parentSession";

const PAGE_SIZE = 12;

// GET /api/parent/announcements
// Returns announcements for all schools the parent is connected to,
// merged and sorted by pinned-first then newest.
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    // Find all organizations this parent is connected to
    const connections = await prisma.connectedParent.findMany({
      where: { parentUserId: session.user.id },
      select: { schoolId: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ success: true, data: [], nextCursor: null });
    }

    const orgIds = [...new Set(connections.map((c) => c.schoolId))];

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || String(PAGE_SIZE), 10),
      50
    );

    const announcements = await prisma.announcement.findMany({
      where: { organizationId: { in: orgIds } },
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, name: true, image: true, schoolName: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = announcements.length > limit;
    const data = hasMore ? announcements.slice(0, limit) : announcements;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    logger.info("[Parent Announcements GET]", { parentId: session.user.id, count: data.length });
    return NextResponse.json({ success: true, data, nextCursor });
  } catch (error: any) {
    logger.error("[Parent Announcements GET] Error", { error: error.message });
    return ApiResponse.error("Failed to load announcements", 500);
  }
}
