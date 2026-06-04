import { prisma } from "@/lib/database/prisma";
import { normalizeGameCombo, comboKey } from "./normalizeGameCombo";

export interface AvailableDate {
  date:       Date;
  dateISO:    string;
  dayOfWeek:  string;
  timeWindow: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared game fetcher — reads ALL non-cancelled, non-sample games in the
// workbook including customFields so normalizeGameCombo can read CSV data.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchWorkbookGames(workbookId: string) {
  return prisma.game.findMany({
    where: {
      workbookId,
      status:      { not: "CANCELLED" },
      isSampleGame: false,
    },
    select: {
      date:         true,
      customFields: true,
      customData:   true,
      homeTeam: {
        select: {
          name:   true,
          sport:  { select: { name: true } },
          level:  true,
          gender: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });
}

/**
 * Computes available dates for a SchedulePost:
 *
 *  1. Fetches all games in the workbook (relational + customFields).
 *  2. Filters in-memory to the target sport/level/gender using normalizeGameCombo
 *     so that games imported via CSV (where sport may be stored in customFields
 *     rather than the Team relation) are handled correctly.
 *  3. Derives the season range from MIN/MAX game dates found.
 *  4. Returns all days in [min, max] that are NOT already scheduled.
 *  5. Respects excludeWeekends and explicitly excluded dates.
 */
export async function computeAvailableDates(
  workbookId: string,
  sport:      string,
  level:      string,
  gender:     string,
  options?: {
    excludeWeekends?: boolean;
    excludedDates?:   string[];
  }
): Promise<AvailableDate[]> {
  const { excludeWeekends = false, excludedDates = [] } = options ?? {};
  const targetKey = comboKey(sport, level, gender);

  const allGames = await fetchWorkbookGames(workbookId);

  // Filter to the target combo using the normalizer
  const comboGames = allGames.filter(
    (g) => comboKey(...Object.values(normalizeGameCombo(g)) as [string, string, string]) === targetKey
  );

  if (comboGames.length === 0) return [];

  // Auto-derive season range
  const dates     = comboGames.map((g) => g.date);
  const minDate   = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate   = new Date(Math.max(...dates.map((d) => d.getTime())));

  const bookedSet  = new Set<string>(dates.map((d) => d.toISOString().slice(0, 10)));
  const excludeSet = new Set<string>(excludedDates.map((d) => d.slice(0, 10)));

  // Generate all days in [max(minDate, today), maxDate]
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const results: AvailableDate[] = [];
  const cursor = new Date(Math.max(minDate.getTime(), today.getTime()));
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(maxDate);
  end.setUTCHours(23, 59, 59, 999);

  while (cursor <= end) {
    const key       = cursor.toISOString().slice(0, 10);
    const dow       = cursor.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    if (!bookedSet.has(key) && !excludeSet.has(key) && !(excludeWeekends && isWeekend)) {
      results.push({
        date:      new Date(cursor),
        dateISO:   cursor.toISOString(),
        dayOfWeek: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(cursor),
        timeWindow: null,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

/**
 * Derives [seasonStart, seasonEnd] from the workbook's actual game data
 * for the given combo.  Returns null if no games match.
 * Uses the same in-memory normalization so CSV-imported games are included.
 */
export async function deriveSeasonRange(
  workbookId: string,
  sport:      string,
  level:      string,
  gender:     string
): Promise<{ seasonStart: Date; seasonEnd: Date } | null> {
  const targetKey = comboKey(sport, level, gender);
  const allGames  = await fetchWorkbookGames(workbookId);

  const comboGames = allGames.filter(
    (g) => comboKey(...Object.values(normalizeGameCombo(g)) as [string, string, string]) === targetKey
  );

  if (comboGames.length === 0) return null;

  const dates     = comboGames.map((g) => g.date.getTime());
  return {
    seasonStart: new Date(Math.min(...dates)),
    seasonEnd:   new Date(Math.max(...dates)),
  };
}
