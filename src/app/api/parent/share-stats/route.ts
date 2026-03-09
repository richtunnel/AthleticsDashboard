import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/share-stats
 * Gets the share stats for the authenticated user
 */
export async function GET(request: NextRequest) {
  // Get user from auth - but for now, we'll pass the code in query params for testing
  // In production, this would require authentication
  const searchParams = request.nextUrl.searchParams;
  const shareCode = searchParams.get("code");

  if (!shareCode) {
    return NextResponse.json({ error: "Share code is required" }, { status: 400 });
  }

  try {
    // Find the user by share code
    const user = await prisma.user.findUnique({
      where: { shareCode },
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

    // Get connected parents stats
    const connectedParents = await prisma.connectedParent.findMany({
      where: {
        schoolId: user.organization?.id,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        membershipStatus: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get parent athlete links
    const parentAthleteLinks = await prisma.parentAthleteLink.findMany({
      where: {
        athleticDirectorId: user.id,
      },
      select: {
        id: true,
        athleteName: true,
        sport: true,
        sportLevel: true,
        createdAt: true,
        parent: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      athleticDirector: {
        id: user.id,
        name: user.name,
        schoolName: user.schoolName,
        organizationName: user.organization?.name,
      },
      stats: {
        totalConnectedParents: connectedParents.length,
        activeParents: connectedParents.filter(p => p.membershipStatus === "ACTIVE" || p.membershipStatus === "TRIALING").length,
        totalParentAthleteLinks: parentAthleteLinks.length,
      },
      recentParents: connectedParents.slice(0, 10).map(p => ({
        id: p.id,
        email: p.email,
        fullName: p.fullName,
        createdAt: p.createdAt,
        membershipStatus: p.membershipStatus,
      })),
    });
  } catch (error) {
    console.error("[API] Error getting share stats:", error);
    return NextResponse.json({ error: "Failed to get share stats" }, { status: 500 });
  }
}
