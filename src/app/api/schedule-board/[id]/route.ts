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

/**
 * PATCH /api/schedule-board/[id]
 * Atomic per-date edits on a SchedulePost the caller owns.
 *
 * Body: { addDate: { date: string, timeWindow?: string | null } }
 *    or { removeDate: string }  — removes from extraDates if manual, else adds to excludedDates
 *
 * Reads only {userId, extraDates, excludedDates} — no full row scan.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const post = await prisma.schedulePost.findUnique({
      where:  { id },
      select: { userId: true, extraDates: true, excludedDates: true },
    });
    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body        = await request.json();
    const extras      = (post.extraDates    as Array<{ date: string; timeWindow: string | null }>) ?? [];
    const excluded    = (post.excludedDates as string[]) ?? [];
    let newExtras     = extras;
    let newExcluded   = excluded;

    if (body.addDate) {
      const dateKey    = (body.addDate.date as string).slice(0, 10);
      const timeWindow = (body.addDate.timeWindow as string | null) ?? null;
      // Upsert: replace existing entry for same date if present
      newExtras   = [...extras.filter((d) => d.date !== dateKey), { date: dateKey, timeWindow }];
      // Un-exclude if it was previously hidden
      newExcluded = excluded.filter((d) => d !== dateKey);
    } else if (body.removeDate) {
      const dateKey   = (body.removeDate as string).slice(0, 10);
      const isManual  = extras.some((d) => d.date === dateKey);
      if (isManual) {
        newExtras = extras.filter((d) => d.date !== dateKey);
      } else if (!excluded.includes(dateKey)) {
        newExcluded = [...excluded, dateKey];
      }
    }

    const updated = await prisma.schedulePost.update({
      where:  { id },
      data:   { extraDates: newExtras, excludedDates: newExcluded, updatedAt: new Date() },
      select: { extraDates: true, excludedDates: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[schedule-board/[id] PATCH]", err);
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
