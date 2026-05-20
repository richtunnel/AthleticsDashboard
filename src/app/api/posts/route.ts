import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getAnySession } from "@/lib/utils/collaboratorSession";

const PAGE_SIZE = 12;

function buildPostSelect(userId?: string) {
  return {
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
      orderBy: { createdAt: "asc" as const },
    },
    // Scoped subqueries: O(1) per post, no extra round trips
    ...(userId
      ? {
          likes: { where: { userId }, select: { id: true }, take: 1 },
          saves: { where: { userId }, select: { id: true }, take: 1 },
        }
      : {}),
  };
}

// GET /api/posts — cursor-based paginated feed with per-user engagement state
export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();
    const userId = session?.user?.id;

    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || String(PAGE_SIZE), 10),
      50
    );

    const posts = await prisma.post.findMany({
      select: buildPostSelect(userId),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = posts.length > limit;
    const raw = hasMore ? posts.slice(0, limit) : posts;

    const data = raw.map(({ likes, saves, ...post }: any) => ({
      ...post,
      isLiked: Array.isArray(likes) ? likes.length > 0 : false,
      isSaved: Array.isArray(saves) ? saves.length > 0 : false,
    }));

    return NextResponse.json({ success: true, data, nextCursor: hasMore ? data[data.length - 1].id : null });
  } catch (error: any) {
    logger.error("[Posts GET] Error", { error: error.message });
    return ApiResponse.error("Failed to load posts", 500);
  }
}

// POST /api/posts — create a post (auth required)
export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const body = await request.json();
    const content: string | undefined = body.content?.trim() || undefined;
    const imagePayload: { url: string; key: string }[] = Array.isArray(body.images)
      ? body.images.slice(0, 4)
      : [];

    if (!content && imagePayload.length === 0) {
      return ApiResponse.error("Post must have content or at least one image.");
    }
    if (content && content.length > 3000) {
      return ApiResponse.error("Post content cannot exceed 3000 characters.");
    }

    const post = await prisma.post.create({
      data: {
        content,
        authorId: session.user.id,
        images: imagePayload.length > 0
          ? { create: imagePayload.map((img) => ({ url: img.url, key: img.key })) }
          : undefined,
      },
      select: buildPostSelect(session.user.id),
    });

    logger.info("[Posts POST] Created post", { postId: post.id, authorId: session.user.id });
    return ApiResponse.success(post, 201);
  } catch (error: any) {
    logger.error("[Posts POST] Error", { error: error.message });
    return ApiResponse.error(error.message || "Failed to create post", 500);
  }
}
