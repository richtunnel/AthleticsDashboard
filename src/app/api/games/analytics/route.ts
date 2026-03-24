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

    // Count games by sport using aggregation instead of fetching all game records
    const gameCountsByTeam = await prisma.game.groupBy({
      by: ["homeTeamId"],
      where: { homeTeam: { organizationId } },
      _count: { id: true },
    });

    const teamsWithSport = await prisma.team.findMany({
      where: { id: { in: gameCountsByTeam.map((g) => g.homeTeamId) } },
      select: { id: true, sport: { select: { name: true } } },
    });

    const teamSportMap = new Map(teamsWithSport.map((t) => [t.id, t.sport.name]));
    const sportStats: Record<string, number> = {};
    gameCountsByTeam.forEach((g) => {
      const sportName = teamSportMap.get(g.homeTeamId) || "Unknown";
      sportStats[sportName] = (sportStats[sportName] || 0) + g._count.id;
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
