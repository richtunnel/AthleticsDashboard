import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * GET /api/parent/overview
 * Returns overview data for parent dashboard.
 *
 * Game lookup uses approved CalendarSyncRequests to ensure we show exactly
 * the sport + level that the AD approved — not just any game at the school.
 * Falls back to sport-name matching from ParentAthleteLink when no requests exist.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      console.warn("[API] /api/parent/overview: no parent session found");
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

    // ── 1. Parent links ──────────────────────────────────────────────────────
    const links = await prisma.parentAthleteLink.findMany({
      where: { parentUserId: user.id },
      include: { school: true },
      orderBy: { createdAt: "desc" },
    });

    // ── 2. Subscription ──────────────────────────────────────────────────────
    const subscription = await prisma.parentSubscription.findFirst({
      where: {
        parentUserId: user.id,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    // ── 3. Calendar connection status ────────────────────────────────────────
    const calendarConnected = !!user.googleCalendarRefreshToken;

    // ── 4. ConnectedParent for syncedAt lookup ───────────────────────────────
    const connectedParent = await prisma.connectedParent.findFirst({
      where: { parentUserId: user.id },
      select: { lastSyncedAt: true, calendarSynced: true },
    });

    // ── 5. Upcoming games ────────────────────────────────────────────────────
    // Strategy A: use approved CalendarSyncRequests (most precise — matches exact
    // sport + level that the AD approved).
    let upcomingGames: any[] = [];

    if (links.length > 0) {
      const schoolIds = [...new Set(links.map((l) => l.schoolId))];

      // Fetch all approved requests for this parent
      const approvedRequests = await prisma.calendarSyncRequest.findMany({
        where: {
          parentUserId: user.id,
          status: "APPROVED",
        },
      });

      const teamIds: string[] = [];

      if (approvedRequests.length > 0) {
        // For each approved request, find the matching team(s)
        for (const req of approvedRequests) {
          // sportLevel may encode gender: "VARSITY MALE", "VARSITY FEMALE", "VARSITY"
          const levelParts = req.sportLevel.trim().split(/\s+/);
          const baseLevel = levelParts[0];
          const gender = levelParts.length > 1 ? levelParts[1] : null;

          const teamWhere: any = {
            organizationId: req.schoolId,
            sport: { name: { equals: req.sportName, mode: "insensitive" } },
            level: { equals: baseLevel, mode: "insensitive" },
          };
          if (gender) {
            teamWhere.gender = gender;
          }

          const teams = await prisma.team.findMany({
            where: teamWhere,
            select: { id: true },
          });

          teamIds.push(...teams.map((t) => t.id));
        }
      } else {
        // Strategy B: fall back to sport name from ParentAthleteLink
        const sportNames = links
          .map((l) => l.sport)
          .filter(Boolean) as string[];

        if (sportNames.length > 0) {
          const teams = await prisma.team.findMany({
            where: {
              organizationId: { in: schoolIds },
              sport: { name: { in: sportNames } },
            },
            select: { id: true },
            take: 20,
          });
          teamIds.push(...teams.map((t) => t.id));
        }
      }

      // Deduplicate team IDs
      const uniqueTeamIds = [...new Set(teamIds)];

      if (uniqueTeamIds.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        upcomingGames = await prisma.game.findMany({
          where: {
            OR: [
              { homeTeamId: { in: uniqueTeamIds } },
              { awayTeamId: { in: uniqueTeamIds } },
            ],
            date: { gte: today },
            status: { in: ["SCHEDULED", "CONFIRMED"] },
          },
          include: {
            homeTeam: { include: { sport: true } },
            awayTeam: true,
            venue: true,
          },
          orderBy: { date: "asc" },
          take: 10,
        });
      }
    }

    // ── 6. Build response ────────────────────────────────────────────────────
    const syncedAt = connectedParent?.lastSyncedAt?.toISOString() || null;

    return NextResponse.json({
      links: links.map((link) => ({
        id: link.id,
        childName: link.athleteName,
        childGrade: link.gradeLevel,
        sportName: link.sport,
        sportLevel: link.gradeLevel, // gradeLevel stores team level (VARSITY, JV…)
        schoolName: link.school?.name || "",
        athleticDirectorName: "", // Not stored on link; AD looked up separately if needed
        confirmed: link.status === "ACTIVE" || link.status === "APPROVED",
        active: link.status === "ACTIVE",
        syncedAt,
        status: link.status,
        createdAt: link.createdAt.toISOString(),
        updatedAt: link.updatedAt.toISOString(),
      })),
      subscription: subscription
        ? {
            status: subscription.status,
            trialEnd: subscription.expiresAt?.toISOString() || null,
            plan: subscription.subscriptionType,
          }
        : null,
      upcomingGames: upcomingGames.map((game) => ({
        id: game.id,
        date: game.date.toISOString(),
        time: game.time,
        isHome: game.isHome,
        location: game.location,
        status: game.status,
        homeTeam: game.homeTeam
          ? {
              id: game.homeTeam.id,
              name: game.homeTeam.name,
              sport: game.homeTeam.sport
                ? { name: game.homeTeam.sport.name }
                : null,
              level: game.homeTeam.level,
            }
          : null,
        awayTeam: game.awayTeam
          ? { id: game.awayTeam.id, name: game.awayTeam.name }
          : null,
        venue: game.venue
          ? { name: game.venue.name, address: game.venue.address }
          : null,
      })),
      calendarConnected,
      calendarSynced: connectedParent?.calendarSynced ?? false,
      lastSyncedAt: syncedAt,
    });
  } catch (error) {
    console.error("[API] Error fetching parent overview:", error);
    return NextResponse.json(
      { error: "Failed to fetch overview" },
      { status: 500 }
    );
  }
}
