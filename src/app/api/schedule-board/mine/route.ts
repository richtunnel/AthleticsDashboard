import { NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const posts = await prisma.schedulePost.findMany({
      where:   { userId: session.user.id },
      include: { workbook: { select: { id: true, name: true } } },
      orderBy: { postedAt: "desc" },
    });

    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[schedule-board/mine GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
