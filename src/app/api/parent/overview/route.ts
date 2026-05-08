import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * GET /api/parent/overview
 * Returns overview data for parent dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();

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
      where: { parentUserId: user.id },
      include: { school: true },
      orderBy: { createdAt: "desc" },
    });

    // Sync request status per link (PENDING / APPROVED only — those disable the button)
    const syncRequests = await prisma.calendarSyncRequest.findMany({
      where: {
        parentUserId: user.id,
        schoolId: { in: links.map((l) => l.schoolId) },
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: { schoolId: true, sportName: true, sportLevel: true, status: true },
    });

    // Monthly request count (capped at 5/month)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthlyRequestCount = await prisma.calendarSyncRequest.count({
      where: { parentUserId: user.id, requestedAt: { gte: monthStart } },
    });

    // AD per school (needed by the sync request call)
    const schoolIds = [...new Set(links.map((l) => l.schoolId))];
    const ads = await prisma.user.findMany({
      where: {
        organizationId: { in: schoolIds },
        role: { in: ["ATHLETIC_DIRECTOR", "ASSISTANT_AD"] },
      },
      select: { id: true, name: true, organizationId: true },
      orderBy: { role: "asc" },
    });
    const adBySchool = new Map(ads.map((a) => [a.organizationId, a]));

    // CalendarSynced flag per school
    const connectedParents = await prisma.connectedParent.findMany({
      where: { parentUserId: user.id, schoolId: { in: schoolIds } },
      select: { schoolId: true, calendarSynced: true },
    });
    const syncedBySchool = new Map(connectedParents.map((c) => [c.schoolId, c.calendarSynced]));

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

    if (links.length > 0) {
      const schoolIds = links.map(l => l.schoolId);
      const sportNames = links.map(l => l.sport).filter(Boolean) as string[];

      if (sportNames.length > 0) {
        // Get teams for these sports at the linked schools
        const teams = await prisma.team.findMany({
          where: {
            organizationId: { in: schoolIds },
            sport: {
              name: { in: sportNames },
            },
          },
          include: {
            sport: true,
          },
          take: 20,
        });

        const teamIds = teams.map(t => t.id);

        // Get upcoming games
        if (teamIds.length > 0) {
          upcomingGames = await prisma.game.findMany({
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
            take: 10,
          });
        }
      }
    }

    return NextResponse.json({
      links: links.map((link) => {
        const sr = syncRequests.find(
          (r) =>
            r.schoolId === link.schoolId &&
            r.sportName === link.sport &&
            r.sportLevel === link.gradeLevel
        );
        const ad = adBySchool.get(link.schoolId);
        return {
          id: link.id,
          childName: link.athleteName,
          childGrade: link.gradeLevel,
          sportName: link.sport,
          sportLevel: link.gradeLevel,
          schoolId: link.schoolId,
          schoolName: link.school?.name || "",
          status: link.status,
          athleticDirectorId: ad?.id ?? null,
          athleticDirectorName: ad?.name ?? null,
          calendarSynced: syncedBySchool.get(link.schoolId) ?? false,
          syncRequestStatus: sr?.status ?? null,
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString(),
        };
      }),
      monthlyRequestCount,
      monthlyRequestLimit: 5,
      subscription: subscription ? {
        status: subscription.status,
        trialEnd: subscription.expiresAt?.toISOString() || null,
        plan: subscription.subscriptionType,
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
