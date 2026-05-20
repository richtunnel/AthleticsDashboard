import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { logger } from "@/lib/utils/logger";

const PAGE_SIZE = 20;
const MAX_LENGTH = 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: postId } = await params;
  const cursor = request.nextUrl.searchParams.get("cursor");

  try {
    const comments = await prisma.postComment.findMany({
      where: { postId },
      select: { id: true, content: true, userId: true, userName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = comments.length > PAGE_SIZE;
    const data = hasMore ? comments.slice(0, PAGE_SIZE) : comments;
    return NextResponse.json({ success: true, data, nextCursor: hasMore ? data[data.length - 1].id : null });
  } catch (error: any) {
    logger.error("[Posts Comments GET]", { error: error.message });
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const userName = session.user.name ?? null;
  const { id: postId } = await params;

  try {
    const body = await request.json();
    const content = (body.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Comment cannot be empty." }, { status: 400 });
    if (content.length > MAX_LENGTH) return NextResponse.json({ error: `Max ${MAX_LENGTH} characters.` }, { status: 400 });

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.postComment.create({
        data: { postId, userId, userName, content },
        select: { id: true, content: true, userId: true, userName: true, createdAt: true },
      });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      return created;
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch (error: any) {
    logger.error("[Posts Comments POST]", { error: error.message });
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: postId } = await params;
  const commentId = request.nextUrl.searchParams.get("commentId");
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const comment = await tx.postComment.findUnique({ where: { id: commentId }, select: { userId: true, postId: true } });
      if (!comment || comment.postId !== postId || comment.userId !== userId) throw new Error("Not found");
      await tx.postComment.delete({ where: { id: commentId } });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } });
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Not found") return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
