import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { announcementSelect } from "../route";

// PATCH /api/announcements/[id] — edit announcement (author only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const { id } = await params;

    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) return ApiResponse.notFound("Announcement not found");
    if (existing.authorId !== session.user.id) return ApiResponse.forbidden();

    const body = await request.json();
    const title = body.title?.trim();
    const content = body.content?.trim();

    if (title !== undefined && !title) return ApiResponse.error("Title cannot be empty.");
    if (title && title.length > 150) return ApiResponse.error("Title cannot exceed 150 characters.");
    if (content !== undefined && !content) return ApiResponse.error("Content cannot be empty.");
    if (content && content.length > 5000) return ApiResponse.error("Content cannot exceed 5000 characters.");

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(body.isPinned !== undefined && { isPinned: Boolean(body.isPinned) }),
      },
      select: announcementSelect,
    });

    logger.info("[Announcements PATCH] Updated", { id });
    return ApiResponse.success(updated);
  } catch (error: any) {
    logger.error("[Announcements PATCH] Error", { error: error.message });
    return ApiResponse.error(error.message || "Failed to update announcement", 500);
  }
}

// DELETE /api/announcements/[id] — delete announcement (author only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const { id } = await params;

    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) return ApiResponse.notFound("Announcement not found");
    if (existing.authorId !== session.user.id) return ApiResponse.forbidden();

    await prisma.announcement.delete({ where: { id } });
    logger.info("[Announcements DELETE] Deleted", { id });
    return ApiResponse.success({ id });
  } catch (error: any) {
    logger.error("[Announcements DELETE] Error", { error: error.message });
    return ApiResponse.error(error.message || "Failed to delete announcement", 500);
  }
}
