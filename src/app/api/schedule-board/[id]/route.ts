import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const post = await prisma.schedulePost.findUnique({ where: { id } });
    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const updated = await prisma.schedulePost.update({
      where: { id },
      data: {
        ...(body.workbookId && { workbookId: body.workbookId }),
        ...(body.seasonStart && { seasonStart: new Date(body.seasonStart) }),
        ...(body.seasonEnd   && { seasonEnd:   new Date(body.seasonEnd) }),
        ...(typeof body.isActive         === "boolean"  && { isActive:         body.isActive }),
        ...(typeof body.excludeWeekends  === "boolean"  && { excludeWeekends:  body.excludeWeekends }),
        ...(Array.isArray(body.excludedDates)            && { excludedDates:   body.excludedDates }),
        ...(body.title       !== undefined               && { title:            body.title ?? null }),
        ...(body.description !== undefined               && { description:      body.description ?? null }),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ post: updated });
  } catch (err) {
    console.error("[schedule-board/[id] PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const post = await prisma.schedulePost.findUnique({ where: { id } });
    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.schedulePost.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[schedule-board/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
