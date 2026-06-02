import { NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { sportComboLabel } from "@/lib/utils/formatGameDateTime";

export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const combos = await prisma.schedulePost.groupBy({
      by:    ["sport", "level", "gender"],
      where: { isActive: true },
      _count: { _all: true },
      orderBy: [{ sport: "asc" }, { level: "asc" }],
    });

    const options = combos.map((c) => ({
      sport:  c.sport,
      level:  c.level,
      gender: c.gender,
      label:  sportComboLabel(c.sport, c.level, c.gender),
      count:  c._count._all,
    }));

    return NextResponse.json({ options });
  } catch (err) {
    console.error("[schedule-board/filters GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
