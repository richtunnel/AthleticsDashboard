import { AvailabilityQuery, GameRow } from "./types";
import { availableDatesService, AvailableDatesResult } from "@/lib/services/available-dates.service";
import { dateToLocalISO, lastDayOfMonth, monthNameToIndex } from "./normalizeDates";

const WEEKDAY_NAMES_FULL = [
  "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday",
];

export interface ScanOptions {
  query: AvailabilityQuery;
  gamesTable: GameRow[];
  candidateDates?: string[];
  referenceDate?: Date;
}

export interface ScanResult extends AvailableDatesResult {
  weekdaysIncluded?: string[];
  weekOfMonthFilter?: number;
  parseMethod?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Extract the set of calendar years that actually appear in the games table. */
function getWorksheetYears(gamesTable: GameRow[]): Set<number> {
  const years = new Set<number>();
  for (const row of gamesTable) {
    if (!row.date) continue;
    try {
      let year: number;
      if (row.date instanceof Date) {
        year = row.date.getUTCFullYear();
      } else if (typeof row.date === "string") {
        const part = row.date.includes("T") ? row.date.split("T")[0] : row.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) continue;
        year = parseInt(part.substring(0, 4), 10);
      } else {
        continue;
      }
      if (!isNaN(year)) years.add(year);
    } catch {
      // skip
    }
  }
  return years;
}

/**
 * Collect every date that appears in ANY row of the games table.
 * Used by the global-scan path (no team specified).
 */
function extractAllOccupiedDates(gamesTable: GameRow[]): Set<string> {
  const occupied = new Set<string>();
  for (const row of gamesTable) {
    if (!row.date) continue;
    try {
      let dateStr: string;
      if (row.date instanceof Date) {
        const y = row.date.getUTCFullYear();
        const m = String(row.date.getUTCMonth() + 1).padStart(2, "0");
        const d = String(row.date.getUTCDate()).padStart(2, "0");
        dateStr = `${y}-${m}-${d}`;
      } else if (typeof row.date === "string") {
        const part = row.date.includes("T") ? row.date.split("T")[0] : row.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(part)) continue;
        dateStr = part;
      } else {
        continue;
      }
      occupied.add(dateStr);
    } catch {
      // skip
    }
  }
  return occupied;
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate date generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateCandidateDates(
  query: AvailabilityQuery,
  referenceDate?: Date,
  /** Years actually on the worksheet — used to pin month-only queries to the right year. */
  worksheetYears?: Set<number>
): string[] {
  const ref = referenceDate ?? new Date();
  const today = dateToLocalISO(ref);
  const dr = query.dateRange;

  function datesInRange(start: Date, end: Date): string[] {
    const result: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      result.push(dateToLocalISO(current));
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  function datesForMonth(year: number, monthIndex: number): string[] {
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex, lastDayOfMonth(year, monthIndex));
    return datesInRange(start, end);
  }

  /**
   * Pick the most appropriate year for a given month index.
   *
   * When worksheetYears is supplied we stay within the dataset:
   *   - If any worksheet year has this month still ahead (or is a future year), use it.
   *   - Otherwise fall back to the maximum worksheet year so we never jump to a
   *     year that isn't represented on the sheet at all.
   */
  function inferYear(monthIndex: number): number {
    if (dr?.year) return dr.year;
    const curYear = ref.getFullYear();
    const curMonth = ref.getMonth();

    if (worksheetYears && worksheetYears.size > 0) {
      const sorted = [...worksheetYears].sort((a, b) => a - b);
      const maxWSYear = sorted[sorted.length - 1];

      for (const year of sorted) {
        if (year > curYear) return year;
        if (year === curYear && monthIndex >= curMonth) return year;
      }
      // Month has already passed in every worksheet year — stay on the max year
      // rather than rolling forward to a year not present on the sheet.
      return maxWSYear;
    }

    // Default (no worksheet context): roll to next year if month has passed
    if (monthIndex < curMonth || (monthIndex === curMonth && ref.getDate() > 20)) {
      return curYear + 1;
    }
    return curYear;
  }

  if (dr?.start || dr?.end) {
    const startDate = dr.start ? new Date(dr.start + "T00:00:00") : ref;
    const endDate = dr.end
      ? new Date(dr.end + "T00:00:00")
      : new Date(ref.getTime() + 90 * 24 * 60 * 60 * 1000);
    return datesInRange(startDate, endDate);
  }

  if (dr?.months && Array.isArray(dr.months) && dr.months.length > 0) {
    const allDates: string[] = [];
    for (const mn of dr.months) {
      const idx = monthNameToIndex(mn);
      if (idx !== -1) {
        const year = inferYear(idx);
        allDates.push(...datesForMonth(year, idx));
      }
    }
    return allDates.sort();
  }

  if (dr?.month) {
    const idx = monthNameToIndex(dr.month);
    if (idx !== -1) {
      const year = inferYear(idx);
      return datesForMonth(year, idx);
    }
  }

  // Default: next 12 months rolling
  const twelveMonthsLater = new Date(ref);
  twelveMonthsLater.setMonth(ref.getMonth() + 12);
  const start = new Date(today + "T00:00:00");
  return datesInRange(start, twelveMonthsLater);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scanner
// ─────────────────────────────────────────────────────────────────────────────

export async function scanWorksheet(opts: ScanOptions): Promise<ScanResult> {
  const { query, gamesTable, referenceDate } = opts;

  // Derive years actually present on the worksheet for year-inference
  const worksheetYears = getWorksheetYears(gamesTable);

  // Generate or accept candidate dates, passing worksheet year context so
  // month-only queries (e.g. "in January") stay within the worksheet's range.
  let candidateDates =
    opts.candidateDates && opts.candidateDates.length > 0
      ? opts.candidateDates
      : generateCandidateDates(query, referenceDate, worksheetYears);

  // Constrain to worksheet years when no explicit year / start / end was given.
  // This prevents the scanner from returning 2027 dates when the worksheet only
  // contains games through 2026.
  if (
    worksheetYears.size > 0 &&
    !query.dateRange?.year &&
    !query.dateRange?.start &&
    !query.dateRange?.end
  ) {
    const constrained = candidateDates.filter((d) => {
      const yr = parseInt(d.substring(0, 4), 10);
      return worksheetYears.has(yr);
    });
    // Only apply the constraint if it leaves at least one date to search
    if (constrained.length > 0) {
      candidateDates = constrained;
    }
  }

  // ── Choose scan path ────────────────────────────────────────────────────────
  let serviceResult: AvailableDatesResult;

  if (query.targetTeams.length === 0) {
    // ── GLOBAL SCAN ──────────────────────────────────────────────────────────
    // No team was specified → treat every game on the worksheet as an occupied
    // date and return candidate dates that have nothing scheduled.
    const occupiedDates = extractAllOccupiedDates(gamesTable);
    const excludeDays = query.excludeDays ?? [];
    const minSpacing = query.minSpacing;
    const maxResults = query.maxResults ?? 50;

    const validCandidates = candidateDates.filter((d) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d)
    );

    let available = validCandidates.filter((d) => !occupiedDates.has(d));

    // Apply excludeDays filter
    const excludedDayNames: string[] = [];
    if (excludeDays.length > 0) {
      excludedDayNames.push(...excludeDays.map((d) => WEEKDAY_NAMES_FULL[d]));
      available = available.filter(
        (d) => !excludeDays.includes(new Date(d + "T00:00:00").getDay())
      );
    }

    // Apply minSpacing filter
    if (minSpacing && minSpacing > 0) {
      const spaced: string[] = [];
      let last: Date | null = null;
      for (const d of available) {
        const cur = new Date(d + "T00:00:00");
        if (
          !last ||
          Math.floor((cur.getTime() - last.getTime()) / 86400000) >= minSpacing
        ) {
          spaced.push(d);
          last = cur;
        }
      }
      available = spaced;
    } else {
      available.sort();
    }

    const recommendations = available.slice(0, maxResults);
    const weekdayCount = recommendations.filter((d) => {
      const day = new Date(d + "T00:00:00").getDay();
      return day !== 0 && day !== 6;
    }).length;

    const notes: string[] = [
      "No team specified — scanning all games for open dates",
    ];
    if (excludedDayNames.length > 0)
      notes.push(`Excluded days: ${excludedDayNames.join(", ")}`);
    if (minSpacing && minSpacing > 0)
      notes.push(`Applied minimum ${minSpacing} day spacing`);
    notes.push(
      `Found ${recommendations.length} available dates (${weekdayCount} weekdays, ${recommendations.length - weekdayCount} weekends)`
    );

    serviceResult = {
      recommendations,
      debug: {
        parsedTokens: [],
        matchedClusters: [],
        clusterDates: Array.from(occupiedDates).sort(),
        excludedClusters: [],
        excludedClusterDates: [],
        notes,
        excludedDays: excludedDayNames,
        minSpacing: minSpacing ?? undefined,
      },
    };
  } else {
    // ── TEAM-SPECIFIC (existing path) ─────────────────────────────────────────
    const cleanPrompt = query.targetTeams
      .map((t) => `${t.gender ?? ""} ${t.level ?? ""} ${t.sport ?? ""}`.trim())
      .join(" ")
      .trim() || "unknown";

    const excludeTeamsPrompt =
      query.excludeTeams && query.excludeTeams.length > 0
        ? query.excludeTeams
            .map((t) =>
              `${t.gender ?? ""} ${t.level ?? ""} ${t.sport ?? ""}`.trim()
            )
            .join(" ")
        : undefined;

    serviceResult = await availableDatesService.findAvailableDates(
      cleanPrompt,
      gamesTable,
      candidateDates,
      {
        maxResults: query.maxResults ?? 50,
        threshold: 2.5,
        excludeDays: query.excludeDays ?? [],
        excludeTeamsPrompt,
        dateRange: query.dateRange
          ? {
              start: query.dateRange.start,
              end: query.dateRange.end,
              month: query.dateRange.month,
              months: query.dateRange.months,
            }
          : undefined,
        minSpacing: query.minSpacing,
      }
    );
  }

  // ── Shared post-filter chain (applies to both paths) ─────────────────────
  const result: ScanResult = { ...serviceResult };

  if (query.weekdaysToInclude && query.weekdaysToInclude.length > 0) {
    const included = query.weekdaysToInclude;
    const before = result.recommendations.length;
    result.recommendations = result.recommendations.filter((dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      return included.includes(d.getDay());
    });
    const filtered = before - result.recommendations.length;
    result.weekdaysIncluded = included.map((d) => WEEKDAY_NAMES_FULL[d]);
    if (filtered > 0) {
      result.debug.notes.push(
        `Applied weekday inclusion filter (${result.weekdaysIncluded.join(", ")}): removed ${filtered} dates`
      );
    }
  }

  if (query.dateRange?.weekOfMonth) {
    const wom = query.dateRange.weekOfMonth;
    const before = result.recommendations.length;

    if (query.dateRange.month || (query.dateRange.months && query.dateRange.months.length > 0)) {
      result.recommendations = result.recommendations.filter((dateStr) => {
        const d = new Date(dateStr + "T00:00:00");
        const dom = d.getDate();
        return Math.ceil(dom / 7) === wom;
      });
    } else if (query.dateRange.start && query.dateRange.end) {
      const startMonth = new Date(query.dateRange.start + "T00:00:00").getMonth();
      result.recommendations = result.recommendations.filter((dateStr) => {
        const d = new Date(dateStr + "T00:00:00");
        if (d.getMonth() !== startMonth) return false;
        const dom = d.getDate();
        return Math.ceil(dom / 7) === wom;
      });
    }

    const filtered = before - result.recommendations.length;
    result.weekOfMonthFilter = wom;
    if (filtered > 0) {
      const ordinalWords = ["","first","second","third","fourth","fifth"];
      result.debug.notes.push(
        `Applied week-of-month filter (${ordinalWords[wom] ?? wom} week): removed ${filtered} dates`
      );
    }
  }

  if (query.interpretation) {
    result.debug.interpretation = query.interpretation;
  }

  if (query.dateRange) {
    const drInfo: { start?: string; end?: string; month?: string; months?: string[] } = {};
    if (query.dateRange.start) drInfo.start = query.dateRange.start;
    if (query.dateRange.end) drInfo.end = query.dateRange.end;
    if (query.dateRange.month) drInfo.month = query.dateRange.month;
    if (query.dateRange.months && query.dateRange.months.length > 0) drInfo.months = query.dateRange.months;
    if (Object.keys(drInfo).length > 0) {
      result.debug.dateRange = drInfo;
    }
  }

  return result;
}
