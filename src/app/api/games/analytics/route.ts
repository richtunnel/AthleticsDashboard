import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Get games count by sport
    const gamesBySport = await prisma.game.groupBy({
      by: ["homeTeamId"],
      where: {
        homeTeam: { organizationId },
      },
      _count: true,
    });

    // Get travel statistics
    const travelStats = await prisma.game.aggregate({
      where: {
        homeTeam: { organizationId },
        travelRequired: true,
      },
      _sum: {
        travelCost: true,
        estimatedTravelTime: true,
      },
      _count: true,
    });

    // Get upcoming games count
    const upcomingGamesCount = await prisma.game.count({
      where: {
        homeTeam: { organizationId },
        date: { gte: new Date() },
      },
    });

    return NextResponse.json({
      gamesBySport,
      travelStats,
      upcomingGamesCount,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
