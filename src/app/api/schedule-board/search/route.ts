import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Use pg_trgm similarity for fuzzy school name matching.
    // Returns users who have at least one active SchedulePost.
    const results = await prisma.$queryRaw<
      Array<{ id: string; schoolName: string | null; city: string | null; similarity: number }>
    >`
      SELECT u.id, u."schoolName", u.city,
             similarity(u."schoolName", ${q}) AS similarity
      FROM   "User" u
      WHERE  u."schoolName" IS NOT NULL
        AND  similarity(u."schoolName", ${q}) > 0.15
        AND  EXISTS (
          SELECT 1 FROM "SchedulePost" sp
          WHERE sp."userId" = u.id AND sp."isActive" = true
        )
      ORDER  BY similarity DESC
      LIMIT  10;
    `;

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[schedule-board/search GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
