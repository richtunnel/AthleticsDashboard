import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getAnySession } from "@/lib/utils/collaboratorSession";

const PAGE_SIZE = 12;

export const announcementSelect = {
  id: true,
  title: true,
  content: true,
  isPinned: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, name: true, image: true, schoolName: true, role: true },
  },
  organizationId: true,
};

// GET /api/announcements — cursor-based paginated list scoped to the AD's org
export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });
    if (!user?.organizationId) return ApiResponse.error("Organization not found", 404);

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || String(PAGE_SIZE), 10),
      50
    );

    const announcements = await prisma.announcement.findMany({
      where: { organizationId: user.organizationId },
      select: announcementSelect,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = announcements.length > limit;
    const data = hasMore ? announcements.slice(0, limit) : announcements;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ success: true, data, nextCursor });
  } catch (error: any) {
    logger.error("[Announcements GET] Error", { error: error.message });
    return ApiResponse.error("Failed to load announcements", 500);
  }
}

// POST /api/announcements — create announcement (AD only)
export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true, role: true },
    });
    if (!user?.organizationId) return ApiResponse.error("Organization not found", 404);
    if (!["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "SUPER_ADMIN"].includes(user.role)) {
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const title = body.title?.trim();
    const content = body.content?.trim();
    const isPinned = Boolean(body.isPinned);

    if (!title) return ApiResponse.error("Title is required.");
    if (title.length > 150) return ApiResponse.error("Title cannot exceed 150 characters.");
    if (!content) return ApiResponse.error("Content is required.");
    if (content.length > 5000) return ApiResponse.error("Content cannot exceed 5000 characters.");

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        isPinned,
        authorId: session.user.id,
        organizationId: user.organizationId,
      },
      select: announcementSelect,
    });

    logger.info("[Announcements POST] Created", { id: announcement.id, authorId: session.user.id });
    return ApiResponse.success(announcement, 201);
  } catch (error: any) {
    logger.error("[Announcements POST] Error", { error: error.message });
    return ApiResponse.error("Something went wrong while posting your announcement. Please try again.", 500);
  }
}
