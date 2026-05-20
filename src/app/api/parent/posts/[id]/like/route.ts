import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

// POST /api/parent/posts/[id]/like
// Atomic toggle using a transaction: upsert the like record and increment/decrement
// the denormalized counter in one round trip. The @@unique([postId, parentId]) index
// ensures the DB rejects duplicate likes even under 10k concurrent requests.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getParentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parentId = session.user.id;
  const { id: postId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: { postId_parentId: { postId, parentId } },
        select: { id: true },
      });

      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      } else {
        await tx.postLike.create({ data: { postId, parentId } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: updated.likeCount };
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
