/**
 * parentCalendarTrigger.service.ts
 *
 * When an AD creates or updates a game, this service checks whether any
 * approved parent calendar-sync requests match the game and, if so, pushes
 * the event to those parents' Google Calendars non-blockingly.
 *
 * Matching uses the same two-strategy logic as syncGamesForSportLevel:
 *  1. DB relations  (homeTeam.sport / level / gender)
 *  2. Keyword scan  (gameMatchesLeague across customFields)
 *
 * Only parents who have:
 *  - An APPROVED CalendarSyncRequest for the game's organisation
 *  - A googleCalendarId saved on that request (set when they ran their first sync)
 *  - A connected Google Calendar account
 *
 * …are included in the push.
 */

import { prisma } from "@/lib/database/prisma";
import { calendarService } from "./calendar.service";
import { runNonCritical } from "@/lib/utils/nonCritical";

/**
 * Trigger parent calendar sync for a newly created or updated game.
 *
 * This is intentionally fire-and-forget — call it with `void` or inside
 * `runNonCritical()` so it never blocks or throws in the AD's request path.
 *
 * @param gameId         The game that was created/updated.
 * @param organizationId The AD's organisation (used to scope the query).
 */
export async function triggerParentCalendarSyncForGame(
  gameId: string,
  organizationId: string
): Promise<void> {
  try {
    // 1. Fetch the game with all fields we need for keyword matching
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          include: { sport: true, organization: true },
        },
        opponent: true,
        awayTeam: true,
        venue: true,
      },
    });

    if (!game) {
      console.warn(`[ParentCalendarTrigger] Game ${gameId} not found — skipping.`);
      return;
    }

    // 2. Find all approved requests for this org that have a saved calendar ID
    //    (googleCalendarId is only set once the parent has run their first sync)
    const approvedRequests = await prisma.calendarSyncRequest.findMany({
      where: {
        schoolId: organizationId,
        status: "APPROVED",
        googleCalendarId: { not: null },
      },
      select: {
        id: true,
        parentUserId: true,
        sportName: true,
        sportLevel: true,
        googleCalendarId: true,
      },
    });

    if (approvedRequests.length === 0) {
      return; // Nothing to do
    }

    // 3. For each request, check if the game matches — if so, sync it
    for (const req of approvedRequests) {
      const matches = calendarService.gameMatchesLeague(
        game,
        req.sportName,
        req.sportLevel
      );

      if (!matches) continue;

      // Pass googleCalendarId so syncGameToCalendar writes to the correct
      // parent calendar instead of falling back to resolveCalendarIdForGame.
      const calendarId = req.googleCalendarId!;

      // Fire-and-forget per parent so one failure doesn't block others
      void runNonCritical(
        () => calendarService.syncGameToCalendar(gameId, req.parentUserId, calendarId),
        `ParentCalendarTrigger:sync:game=${gameId}:parent=${req.parentUserId}`
      );
    }
  } catch (error) {
    // Never throw — this runs in the background after the AD's response
    console.error("[ParentCalendarTrigger] Unexpected error:", error);
  }
}
