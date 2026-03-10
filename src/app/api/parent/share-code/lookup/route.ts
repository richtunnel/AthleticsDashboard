import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/share-code/lookup
 * Looks up athletic director info by share code (public endpoint)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Share code is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { shareCode: code },
      select: {
        id: true,
        name: true,
        schoolName: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid share code" }, { status: 404 });
    }

    return NextResponse.json({
      athleticDirectorId: user.id,
      athleticDirectorName: user.name || "Athletic Director",
      schoolId: user.organization?.id,
      schoolName: user.schoolName || user.organization?.name || "School",
      organizationName: user.organization?.name,
    });
  } catch (error) {
    console.error("[API] Error looking up share code:", error);
    return NextResponse.json({ error: "Failed to look up share code" }, { status: 500 });
  }
}
