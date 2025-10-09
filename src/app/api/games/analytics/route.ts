import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const organizationId = session.user.organizationId;

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

    // Get games by sport with proper counting
    const gamesWithSport = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
      },
    });

    // Count games by sport
    const sportStats: Record<string, number> = {};
    gamesWithSport.forEach((game: any) => {
      const sportName = game.homeTeam.sport.name;
      sportStats[sportName] = (sportStats[sportName] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        upcomingGamesCount,
        travelStats: {
          _sum: {
            travelCost: travelStats._sum.travelCost || 0,
            estimatedTravelTime: travelStats._sum.estimatedTravelTime || 0,
          },
          _count: travelStats._count,
        },
        sportStats,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch analytics",
      },
      { status: 500 }
    );
  }
}
