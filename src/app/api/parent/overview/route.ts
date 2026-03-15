import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/auth";

/**
 * GET /api/parent/overview
 * Returns overview data for parent dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get parent links
    const links = await prisma.parentAthleteLink.findMany({
      where: {
        parentUserId: user.id,
        active: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get subscription
    const subscription = await prisma.parentSubscription.findFirst({
      where: {
        parentUserId: user.id,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // Check if calendar is connected
    const calendarConnected = !!user.googleCalendarRefreshToken;

    // Get upcoming games from all linked schools
    let upcomingGames: any[] = [];
    const seenGameIds = new Set<string>();

    if (links.length > 0) {
      const schoolIds = links.map(l => l.schoolId);
      const sportNames = links.map(l => l.sportName);
      const sportLevels = links.map(l => l.sportLevel);

      // Path 1: Team-based matching (existing logic)
      const teams = await prisma.team.findMany({
        where: {
          organizationId: { in: schoolIds },
          sport: {
            name: { in: sportNames },
          },
          level: {
            in: sportLevels.map(l => l.split(' ')[0]),
          },
        },
        include: {
          sport: true,
        },
        take: 10,
      });

      const teamIds = teams.map(t => t.id);

      if (teamIds.length > 0) {
        const teamGames = await prisma.game.findMany({
          where: {
            OR: [
              { homeTeamId: { in: teamIds } },
              { awayTeamId: { in: teamIds } },
            ],
            date: { gte: new Date() },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
          include: {
            homeTeam: {
              include: { sport: true },
            },
            awayTeam: true,
            venue: true,
          },
          orderBy: { date: "asc" },
          take: 20,
        });
        for (const game of teamGames) {
          if (!seenGameIds.has(game.id)) {
            seenGameIds.add(game.id);
            upcomingGames.push(game);
          }
        }
      }

      // Path 2: CustomFields-based matching via approved ParentScheduleMappings
      const linkIds = links.map(l => l.id);
      const approvedMappings = await prisma.parentScheduleMapping.findMany({
        where: {
          parentAthleteLinkId: { in: linkIds },
          status: "APPROVED",
        },
      });

      for (const mapping of approvedMappings) {
        try {
          // Query games where customFields contains the mapped column/value
          const mappedGames: any[] = await prisma.$queryRaw`
            SELECT g.id, g.date, g.time, g.status, g.notes, g.location,
                   g."isHome", g."customFields", g."homeTeamId", g."awayTeamId",
                   g."venueId", g."departureTime", g."createdAt", g."updatedAt"
            FROM "Game" g
            JOIN "Team" t ON g."homeTeamId" = t.id
            WHERE t."organizationId" = ${mapping.organizationId}
              AND g."customFields" IS NOT NULL
              AND g."customFields"->>CAST(${mapping.columnName} AS text) = ${mapping.columnValue}
              AND g.date >= NOW()
              AND g.status IN ('SCHEDULED', 'CONFIRMED')
            ORDER BY g.date ASC
            LIMIT 20
          `;

          for (const game of mappedGames) {
            if (!seenGameIds.has(game.id)) {
              seenGameIds.add(game.id);
              upcomingGames.push(game);
            }
          }
        } catch (err) {
          console.error("[API] Error querying mapped games:", err);
        }
      }

      // Sort merged results by date
      upcomingGames.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      upcomingGames = upcomingGames.slice(0, 20);
    }

    return NextResponse.json({
      links: links.map(link => ({
        ...link,
        syncedAt: link.syncedAt?.toISOString(),
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      })),
      subscription: subscription ? {
        status: subscription.status,
        trialEnd: subscription.trialEnd?.toISOString(),
        plan: subscription.plan,
      } : null,
      upcomingGames: upcomingGames.map(game => ({
        ...game,
        date: game.date.toISOString(),
        departureTime: game.departureTime?.toISOString(),
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt.toISOString(),
      })),
      calendarConnected,
    });
  } catch (error) {
    console.error("[API] Error fetching parent overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    );
  }
}
