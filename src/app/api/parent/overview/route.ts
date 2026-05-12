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
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // getParentSession() already verified the user exists and patched in the
    // canonical DB email — do a straightforward exact lookup here.
    // Fallback to findFirst with case-insensitive email as a last resort.
    const sessionUserId = (session.user as any).id as string | undefined;
    let user = sessionUserId ? await prisma.user.findUnique({ where: { id: sessionUserId } }) : null;

    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: { equals: session.user.email, mode: "insensitive" } },
      });
    }

    if (!user) {
      console.error("[overview] User not found — email:", session.user.email, "id:", sessionUserId);
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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

    // ── 4b. All CalendarSyncRequests — for per-sport status on child cards ───
    // Ordered newest-first so we take the latest status for each slot.
    const allSyncRequests = await prisma.calendarSyncRequest.findMany({
      where: { parentUserId: user.id },
      include: { school: { select: { name: true } } },
      orderBy: { requestedAt: "desc" },
    });

    // Map: "schoolId|sportName|sportLevel" (lowercased) → most-recent request
    // Used to decorate each ParentAthleteLink card with its sync status.
    const syncStatusBySlot = new Map<
      string,
      { status: string; requestId: string }
    >();
    for (const req of allSyncRequests) {
      const key = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
      if (!syncStatusBySlot.has(key)) {
        syncStatusBySlot.set(key, { status: req.status, requestId: req.id });
      }
    }

    // ── 5. Upcoming games ────────────────────────────────────────────────────
    // Primary path: match sport + level directly from each ParentAthleteLink.
    // No CalendarSyncRequest approval is required — games appear automatically
    // as soon as the AD imports or syncs their worksheet.
    // gradeLevel on ParentAthleteLink stores the TEAM level (VARSITY, JV, …),
    // not the child's school grade.
    let upcomingGames: any[] = [];

    if (links.length > 0) {
      const teamIdSet = new Set<string>();

      // Primary: sport + level match per link
      for (const link of links) {
        if (!link.sport) continue;

        const teamWhere: any = {
          organizationId: link.schoolId,
          sport: { name: { equals: link.sport, mode: "insensitive" } },
        };

        // Match level when available so a parent linked to "Varsity Basketball"
        // sees only Varsity games, not every basketball team at that school.
        if (link.gradeLevel) {
          teamWhere.level = { equals: link.gradeLevel, mode: "insensitive" };
        }

        const teams = await prisma.team.findMany({
          where: teamWhere,
          select: { id: true },
        });

        teams.forEach((t) => teamIdSet.add(t.id));
      }

      // Supplementary: approved CalendarSyncRequests add any additional teams
      // (covers the case where ADs approved access for a specific sport/level/gender
      // combination that the direct link didn't pick up).
      const approvedRequests = await prisma.calendarSyncRequest.findMany({
        where: { parentUserId: user.id, status: "APPROVED" },
      });

      for (const req of approvedRequests) {
        const levelParts = req.sportLevel.trim().split(/\s+/);
        const baseLevel = levelParts[0];
        const gender = levelParts.length > 1 ? levelParts[1] : null;

        const teamWhere: any = {
          organizationId: req.schoolId,
          sport: { name: { equals: req.sportName, mode: "insensitive" } },
          level: { equals: baseLevel, mode: "insensitive" },
        };
        if (gender) teamWhere.gender = gender;

        const teams = await prisma.team.findMany({
          where: teamWhere,
          select: { id: true },
        });
        teams.forEach((t) => teamIdSet.add(t.id));
      }

      const uniqueTeamIds = [...teamIdSet];

      if (uniqueTeamIds.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        upcomingGames = await prisma.game.findMany({
          where: {
            OR: [{ homeTeamId: { in: uniqueTeamIds } }, { awayTeamId: { in: uniqueTeamIds } }],
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

    // ── 7. Build response ────────────────────────────────────────────────────
    const syncedAt = connectedParent?.lastSyncedAt?.toISOString() || null;

    return NextResponse.json({
      links: links.map((link) => {
        const slotKey = `${link.schoolId}|${(link.sport || "").toLowerCase()}|${(link.gradeLevel || "").toLowerCase()}`;
        const slotStatus = syncStatusBySlot.get(slotKey);
        return {
          id: link.id,
          childName: link.athleteName,
          childGrade: link.gradeLevel,
          sportName: link.sport,
          // gradeLevel stores the team level (VARSITY, JV…), not the child's grade
          sportLevel: link.gradeLevel,
          schoolId: link.schoolId,
          schoolName: link.school?.name || "",
          confirmed: link.status === "ACTIVE" || link.status === "APPROVED",
          active: link.status === "ACTIVE",
          syncedAt,
          status: link.status,
          // Per-sport calendar sync status so each child card knows its state
          calendarSyncStatus: (slotStatus?.status ?? "NONE") as
            | "APPROVED"
            | "PENDING"
            | "REJECTED"
            | "NONE",
          createdAt: link.createdAt.toISOString(),
          updatedAt: link.updatedAt.toISOString(),
        };
      }),
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
              sport: game.homeTeam.sport ? { name: game.homeTeam.sport.name } : null,
              level: game.homeTeam.level,
            }
          : null,
        awayTeam: game.awayTeam ? { id: game.awayTeam.id, name: game.awayTeam.name } : null,
        venue: game.venue ? { name: game.venue.name, address: game.venue.address } : null,
      })),
      calendarConnected,
      calendarSynced: connectedParent?.calendarSynced ?? false,
      lastSyncedAt: syncedAt,
      // Full request list — used by settings page to show status per sport/level
      // and offer re-sync when AD has revoked access.
      syncRequests: allSyncRequests.map((r) => ({
        id: r.id,
        sportName: r.sportName,
        sportLevel: r.sportLevel,
        schoolId: r.schoolId,
        schoolName: r.school?.name ?? "",
        status: r.status as "PENDING" | "APPROVED" | "REJECTED",
        rejectionReason: r.rejectionReason ?? null,
        requestedAt: r.requestedAt.toISOString(),
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching parent overview:", error);
    return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
  }
}
