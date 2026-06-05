import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/ad-chat/search?q=partial_email_or_name
 * Returns ADs, assistant ADs, coaches, and staff matching the query.
 * Excludes the current user.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  try {
    const users = await prisma.user.findMany({
      where: {
        id:          { not: session.user.id },
        isDisabled:  false,
        isMemberAccess: false,
        role:        { in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH", "STAFF"] },
        OR: [
          { email:      { contains: q, mode: "insensitive" } },
          { name:       { contains: q, mode: "insensitive" } },
          { schoolName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id:         true,
        name:       true,
        email:      true,
        schoolName: true,
        teamName:   true,
        image:      true,
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[ad-chat/search]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
