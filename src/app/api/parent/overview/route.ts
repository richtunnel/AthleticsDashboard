import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { cached } from "@/lib/cache/redisCache";
import { parseSportLabel, normaliseLevel } from "@/lib/utils/sportMatch";
import type { Prisma } from "@prisma/client";

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

    // ── Cache the whole overview for 30s per user ───────────────────────────
    // Cuts repeat dashboard loads from ~6 DB queries to 0. Invalidate on:
    //   • New child added / removed   (call invalidate(`parent:overview:${userId}`))
    //   • New sync request submitted
    //   • Sync request approved/rejected
    const cacheKey = `parent:overview:${user.id}`;
    const responseData = await cached(cacheKey, 30, async () => {
      return await buildOverviewResponse(user);
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("[API] Error fetching parent overview:", error);
    return NextResponse.json({ error: "Failed to fetch overview" }, { status: 500 });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Case-insensitive lookup of a value from a game's customFields JSON blob.
 * Worksheet-imported games store opponent, sport, level, etc. as JSON keys
 * that may vary in capitalisation ("Away", "away", "AWAY" …).
 */
function getCustomField(customFields: unknown, names: string[]): string | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return null;
  const cf = customFields as Record<string, unknown>;
  for (const name of names) {
    const exact = cf[name];
    if (exact && typeof exact === "string" && exact.trim()) return exact.trim();
    const key = Object.keys(cf).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && typeof cf[key] === "string" && (cf[key] as string).trim())
      return (cf[key] as string).trim();
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal helper — produces the full overview payload from the DB.
// Extracted so the cache wrapper above can be a single one-liner.
// ──────────────────────────────────────────────────────────────────────────────
async function buildOverviewResponse(user: { id: string; googleCalendarRefreshToken: string | null }) {
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
  // Exclude REMOVED rows from the dashboard view. They're kept in the DB so
  // a re-request can resurrect the approval, but to the parent they should
  // look like there's no active request (the "Request Sync" button shows).
  const allSyncRequests = await prisma.calendarSyncRequest.findMany({
    where: { parentUserId: user.id, status: { not: "REMOVED" } },
    include: { school: { select: { name: true } } },
    orderBy: { requestedAt: "desc" },
  });

  // Map: "schoolId|sportName|sportLevel" (lowercased) → most-recent request
  // Used to decorate each ParentAthleteLink card with its sync status.
  const syncStatusBySlot = new Map<string, { status: string; requestId: string }>();
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

  // Hoisted outside the links guard so the serialisation block below can
  // always reference them, even when links.length === 0.
  const teamIdToLinkIds = new Map<string, string[]>();
  const workbookIdToLinkIds = new Map<string, string[]>();

  if (links.length > 0) {
    const teamIdSet = new Set<string>();

    // Build a team-where that handles every realistic naming combo:
    //   • Sport.name = "Boys Basketball"   ← exact match (legacy)
    //   • Sport.name = "Basketball" AND Team.gender = MALE   ← normalised
    //   • Sport.name = "Basketball" AND no gender info       ← loose fallback
    // Level is normalised so "VARSITY", "Varsity", "Junior Varsity" / "JV"
    // all line up.
    const buildTeamWhere = (schoolId: string, sportInput: string, levelInput: string | null): Prisma.TeamWhereInput => {
      const { baseSport, gender } = parseSportLabel(sportInput);
      const level = normaliseLevel(levelInput);

      const sportClauses: Prisma.TeamWhereInput[] = [
        // exact match of whatever the parent typed
        { sport: { name: { equals: sportInput, mode: "insensitive" } } },
      ];
      if (baseSport && baseSport.toLowerCase() !== sportInput.toLowerCase()) {
        // base sport + (optional) gender — covers "Boys Basketball" → "Basketball" + MALE
        sportClauses.push({
          sport: { name: { equals: baseSport, mode: "insensitive" } },
          ...(gender ? { gender } : {}),
        });
      }

      const where: Prisma.TeamWhereInput = {
        organizationId: schoolId,
        OR: sportClauses,
      };

      if (level) {
        // Accept exact level OR "junior varsity" ↔ "jv"
        where.AND = [
          {
            OR: [
              { level: { equals: level, mode: "insensitive" } },
              ...(level === "jv" ? [{ level: { equals: "Junior Varsity", mode: "insensitive" as const } }] : []),
              ...(level === "junior varsity" ? [{ level: { equals: "JV", mode: "insensitive" as const } }] : []),
            ],
          },
        ];
      }

      return where;
    };

    // ── Attribution maps ─────────────────────────────────────────────────────
    // teamIdToLinkIds / workbookIdToLinkIds are declared above the if-block so
    // the serialisation step can always reference them (hoisted).
    //
    //   teamIdToLinkIds    : DB team ID  → [linkId, ...]
    //   workbookIdToLinkIds: workbook ID → [linkId, ...]

    /** Add linkId to the map entry for `key`, deduplicating in-place. */
    function addAttribution(map: Map<string, string[]>, key: string, linkId: string) {
      const arr = map.get(key) ?? [];
      if (!arr.includes(linkId)) arr.push(linkId);
      map.set(key, arr);
    }

    // Primary: sport + level match per link
    for (const link of links) {
      if (!link.sport) continue;
      const teams = await prisma.team.findMany({
        where: buildTeamWhere(link.schoolId, link.sport, link.gradeLevel),
        select: { id: true },
      });
      for (const t of teams) {
        teamIdSet.add(t.id);
        addAttribution(teamIdToLinkIds, t.id, link.id);
      }
    }

    // Supplementary: approved CalendarSyncRequests add additional teams when
    // the AD approved a slightly different sport/level/gender combo than
    // what's on the link.
    const approvedRequests = await prisma.calendarSyncRequest.findMany({
      where: { parentUserId: user.id, status: "APPROVED" },
      select: { schoolId: true, sportName: true, sportLevel: true, workbookId: true },
    });

    // Collect workbook IDs the AD pinned during approval — we'll include
    // EVERY game from those workbooks below (regardless of Team matching).
    // This is the killer fix for cases where imported games never produced
    // properly normalised Team rows.
    const approvedWorkbookIds = new Set<string>();

    for (const req of approvedRequests) {
      // Resolve which ParentAthleteLink corresponds to this sync request so
      // workbook-path games can be attributed to the right child.
      const reqSlot = `${req.schoolId}|${req.sportName.toLowerCase()}|${req.sportLevel.toLowerCase()}`;
      const matchingLink = links.find(
        (l) =>
          `${l.schoolId}|${(l.sport ?? "").toLowerCase()}|${(l.gradeLevel ?? "").toLowerCase()}` ===
          reqSlot
      );

      const teams = await prisma.team.findMany({
        where: buildTeamWhere(req.schoolId, req.sportName, req.sportLevel),
        select: { id: true },
      });
      for (const t of teams) {
        teamIdSet.add(t.id);
        if (matchingLink) addAttribution(teamIdToLinkIds, t.id, matchingLink.id);
      }

      if (req.workbookId) {
        approvedWorkbookIds.add(req.workbookId);
        if (matchingLink) addAttribution(workbookIdToLinkIds, req.workbookId, matchingLink.id);
      }
    }

    const uniqueTeamIds = [...teamIdSet];
    const uniqueWorkbookIds = [...approvedWorkbookIds];

    if (uniqueTeamIds.length > 0 || uniqueWorkbookIds.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Match a game when EITHER:
      //   • it belongs to one of the matched teams, OR
      //   • it's in a workbook the AD pinned during sync approval
      const gameMatchers: Prisma.GameWhereInput[] = [];
      if (uniqueTeamIds.length > 0) {
        gameMatchers.push({ homeTeamId: { in: uniqueTeamIds } });
        gameMatchers.push({ awayTeamId: { in: uniqueTeamIds } });
      }
      if (uniqueWorkbookIds.length > 0) {
        gameMatchers.push({ workbookId: { in: uniqueWorkbookIds } });
      }

      // Scale the fetch limit proportionally so every child's schedule is
      // fully represented — 30 upcoming games per link, min 50, hard cap 200.
      const gameFetchLimit = Math.min(200, Math.max(50, links.length * 30));

      upcomingGames = await prisma.game.findMany({
        where: {
          OR: gameMatchers,
          date: { gte: today },
          status: { in: ["SCHEDULED", "CONFIRMED", "CANCELLED"] },
        },
        include: {
          homeTeam: { include: { sport: true } },
          awayTeam: true,
          opponent: true,
          venue: true,
        },
        orderBy: { date: "asc" },
        take: gameFetchLimit,
      });
    }
  }

  // ── 7. Build response ────────────────────────────────────────────────────
  const syncedAt = connectedParent?.lastSyncedAt?.toISOString() || null;

  return {
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
        // Per-sport calendar sync status so each child card knows its state.
        // Exposed under TWO names because different pages read either —
        // keep both in sync.
        calendarSyncStatus: (slotStatus?.status ?? "NONE") as "APPROVED" | "PENDING" | "REJECTED" | "NONE",
        syncStatus: (slotStatus?.status ?? "NONE") as "APPROVED" | "PENDING" | "REJECTED" | "NONE",
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
    upcomingGames: upcomingGames.map((game) => {
      // Worksheet-imported games store sport, level, and opponent in customFields
      // rather than DB relations. Resolve from all sources so the parent dashboard
      // always shows real names instead of "General" / "TBD".
      const cf = game.customFields;
      const resolvedSport =
        getCustomField(cf, ["Sport"]) || game.homeTeam?.sport?.name?.trim() || null;
      const resolvedLevel =
        getCustomField(cf, ["Level"]) || game.homeTeam?.level?.trim() || null;
      const resolvedOpponent =
        getCustomField(cf, ["Away", "Opponent", "Enemy", "Visiting Team", "Visitor"]) ||
        game.opponent?.name?.trim() ||
        game.awayTeam?.name?.trim() ||
        null;

      // Build per-link attribution. PRECEDENCE MATTERS — see below.
      //
      // 1. Team-based attribution is precise (buildTeamWhere is gender-aware,
      //    sport-aware, level-aware). If a game's team matches a link's team
      //    set, that link owns the game. Period.
      //
      // 2. Workbook-based attribution is a FALLBACK for imported games whose
      //    team rows never got normalised. It's per-workbook, so when one
      //    workbook holds BOTH boys and girls games (very common in test
      //    data), naively merging it with team-based attribution causes the
      //    girls child's tab to show boys games and vice versa.
      //
      // Rule: workbook attribution only contributes link IDs when team
      // attribution found NONE for this game. Even then, we constrain it to
      // links whose sport/level matches the game's resolved sport/level so
      // a shared-workbook scenario can't cross-pollinate.
      const teamLinkIds = new Set<string>([
        ...(teamIdToLinkIds.get(game.homeTeamId) ?? []),
        ...(game.awayTeamId ? (teamIdToLinkIds.get(game.awayTeamId) ?? []) : []),
      ]);
      const linkIdSet = new Set<string>(teamLinkIds);

      if (teamLinkIds.size === 0 && game.workbookId) {
        const candidateLinkIds = workbookIdToLinkIds.get(game.workbookId) ?? [];

        // Resolve the game's effective sport/level from any source we trust:
        //   • homeTeam relation (if present and populated)
        //   • customFields["Sport"] / ["Level"]
        const gSportRaw = (resolvedSport ?? "").toLowerCase().trim();
        const gLevelRaw = (resolvedLevel ?? "").toLowerCase().trim();
        const { baseSport: gBaseSport, gender: gGender } = gSportRaw
          ? parseSportLabel(gSportRaw)
          : { baseSport: "", gender: null as null };

        for (const lid of candidateLinkIds) {
          const link = links.find((l) => l.id === lid);
          if (!link) continue;

          const lSportRaw = (link.sport ?? "").toLowerCase().trim();
          const lLevelRaw = normaliseLevel(link.gradeLevel) ?? "";
          const { baseSport: lBaseSport, gender: lGender } = lSportRaw
            ? parseSportLabel(lSportRaw)
            : { baseSport: "", gender: null as null };

          // Sport must match either as a raw label or via base+gender pair.
          const sportMatches =
            (gSportRaw && lSportRaw && gSportRaw === lSportRaw) ||
            (gBaseSport && lBaseSport &&
              gBaseSport.toLowerCase() === lBaseSport.toLowerCase() &&
              (!lGender || !gGender || lGender === gGender));

          // Level must match when both sides provide one. If either side is
          // empty, accept (don't reject on missing data).
          const levelMatches =
            !lLevelRaw || !gLevelRaw ||
            lLevelRaw === gLevelRaw ||
            (lLevelRaw === "jv" && gLevelRaw === "junior varsity") ||
            (lLevelRaw === "junior varsity" && gLevelRaw === "jv");

          if (sportMatches && levelMatches) {
            linkIdSet.add(lid);
          }
        }
      }

      return {
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
              sport: resolvedSport ? { name: resolvedSport } : null,
              level: resolvedLevel,
            }
          : null,
        // Merge all opponent sources into awayTeam so the frontend needs only one check
        awayTeam: resolvedOpponent
          ? { id: game.awayTeam?.id ?? game.opponent?.id ?? "ext", name: resolvedOpponent }
          : null,
        opponent: game.opponent ? { id: game.opponent.id, name: game.opponent.name } : null,
        venue: game.venue ? { name: game.venue.name, address: game.venue.address } : null,
        // IDs of the ParentAthleteLinks that caused this game to appear.
        // The client uses this for exact-match tab isolation — no fuzzy string
        // matching needed, no risk of cross-child contamination.
        linkIds: [...linkIdSet],
      };
    }),
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
      googleCalendarId: r.googleCalendarId ?? null,
    })),
  };
}
