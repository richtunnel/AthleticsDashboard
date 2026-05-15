import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getAnySession } from "@/lib/utils/collaboratorSession";

const PAGE_SIZE = 12;

const postSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      image: true,
      schoolName: true,
      role: true,
    },
  },
  images: {
    select: { id: true, url: true, key: true },
    orderBy: { createdAt: "asc" as const },
  },
};

// GET /api/posts — public, cursor-based paginated feed
export async function GET(request: NextRequest) {
  try {
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || String(PAGE_SIZE), 10),
      50
    );

    const posts = await prisma.post.findMany({
      select: postSelect,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // fetch one extra to know if there's a next page
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    });

    const hasMore = posts.length > limit;
    const data = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return NextResponse.json({ success: true, data, nextCursor });
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
      select: postSelect,
    });

    logger.info("[Posts POST] Created post", { postId: post.id, authorId: session.user.id });
    return ApiResponse.success(post, 201);
  } catch (error: any) {
    logger.error("[Posts POST] Error", { error: error.message });
    return ApiResponse.error(error.message || "Failed to create post", 500);
  }
}
