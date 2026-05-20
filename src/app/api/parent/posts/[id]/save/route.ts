import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

// POST /api/parent/posts/[id]/save — same atomic pattern as the like route.
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
      const existing = await tx.postSave.findUnique({
        where: { postId_parentId: { postId, parentId } },
        select: { id: true },
      });

      if (existing) {
        await tx.postSave.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { saveCount: { decrement: 1 } },
          select: { saveCount: true },
        });
        return { saved: false, saveCount: Math.max(0, updated.saveCount) };
      } else {
        await tx.postSave.create({ data: { postId, parentId } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { saveCount: { increment: 1 } },
          select: { saveCount: true },
        });
        return { saved: true, saveCount: updated.saveCount };
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to toggle save" }, { status: 500 });
  }
}
