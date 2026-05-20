import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { logger } from "@/lib/utils/logger";

const COMMENT_PAGE_SIZE = 20;
const MAX_COMMENT_LENGTH = 1000;

// GET /api/parent/posts/[id]/comments — cursor-paginated, newest first
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getParentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  const cursor = request.nextUrl.searchParams.get("cursor");

  try {
    const comments = await prisma.postComment.findMany({
      where: { postId },
      select: {
        id: true,
        content: true,
        parentId: true,
        parentName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: COMMENT_PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = comments.length > COMMENT_PAGE_SIZE;
    const data = hasMore ? comments.slice(0, COMMENT_PAGE_SIZE) : comments;

    return NextResponse.json({
      success: true,
      data,
      nextCursor: hasMore ? data[data.length - 1].id : null,
    });
  } catch (error: any) {
    logger.error("[Parent Comments GET] Error", { error: error.message });
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

// POST /api/parent/posts/[id]/comments — create a comment and atomically increment counter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getParentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parentId = session.user.id;
  const parentName = session.user.name ?? null;
  const { id: postId } = await params;

  try {
    const body = await request.json();
    const content = (body.content ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.postComment.create({
        data: { postId, parentId, parentName, content },
        select: { id: true, content: true, parentId: true, parentName: true, createdAt: true },
      });
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });
      return created;
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error: any) {
    logger.error("[Parent Comments POST] Error", { error: error.message });
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}

// DELETE /api/parent/posts/[id]/comments?commentId=xxx — own comments only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getParentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parentId = session.user.id;
  const { id: postId } = await params;
  const commentId = request.nextUrl.searchParams.get("commentId");

  if (!commentId) {
    return NextResponse.json({ error: "commentId is required" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const comment = await tx.postComment.findUnique({
        where: { id: commentId },
        select: { parentId: true, postId: true },
      });
      if (!comment || comment.postId !== postId || comment.parentId !== parentId) {
        throw new Error("Not found");
      }
      await tx.postComment.delete({ where: { id: commentId } });
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Not found") {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
