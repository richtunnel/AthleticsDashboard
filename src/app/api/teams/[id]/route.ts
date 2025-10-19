import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { TeamLevel, type Prisma } from "@prisma/client";

// Fix: Params should be the direct params object, not wrapped
type Params = { id: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const team = await prisma.team.findUnique({
    where: { id },
    include: { sport: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ data: team });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  const body = (await req.json()) ?? {};
  const { name, level, location, sportId } = body as {
    name?: string;
    level?: string;
    location?: string;
    sportId?: string | null;
  };

  // Build Prisma.TeamUpdateInput
  const data: Prisma.TeamUpdateInput = {
    ...(name !== undefined ? { name } : {}),
    ...(level !== undefined ? TeamLevel : {}),
    ...(location !== undefined ? { location } : {}),
    ...(sportId !== undefined ? (sportId === null ? { sport: { disconnect: true } } : { sport: { connect: { id: sportId } } }) : {}),
  } as any;

  try {
    const updated = await prisma.team.update({
      where: { id },
      data,
      include: { sport: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update team" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  try {
    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete team" }, { status: 400 });
  }
}
