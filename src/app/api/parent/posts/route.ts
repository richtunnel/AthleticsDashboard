import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { logger } from "@/lib/utils/logger";

const PAGE_SIZE = 12;

// GET /api/parent/posts
// Returns paginated posts with per-parent like/save state in a single query.
// No N+1: we fetch like/save existence via a subquery in the select.
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parentId = session.user.id;

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || String(PAGE_SIZE), 10),
      50
    );

    const posts = await prisma.post.findMany({
      select: {
        id: true,
        content: true,
        likeCount: true,
        saveCount: true,
        commentCount: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, image: true, schoolName: true, role: true },
        },
        images: {
          select: { id: true, url: true, key: true },
          orderBy: { createdAt: "asc" },
        },
        // Single-row existence checks — no extra round trips
        likes: {
          where: { parentId },
          select: { id: true },
          take: 1,
        },
        saves: {
          where: { parentId },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = posts.length > limit;
    const raw = hasMore ? posts.slice(0, limit) : posts;

    const data = raw.map(({ likes, saves, ...post }) => ({
      ...post,
      isLiked: likes.length > 0,
      isSaved: saves.length > 0,
    }));

    return NextResponse.json({ success: true, data, nextCursor: hasMore ? data[data.length - 1].id : null });
  } catch (error: any) {
    logger.error("[Parent Posts GET] Error", { error: error.message });
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}
