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

  // Year-only query (no month / start / end): return every date in that year.
  // Without this branch we used to fall through to the "rolling 12 months"
  // default and ignore dr.year entirely — that's why a `year: 2026` filter
  // was producing 2027 dates.
  if (dr?.year) {
    const start = new Date(dr.year, 0, 1);
    const end = new Date(dr.year, 11, 31);
    return datesInRange(start, end);
  }

  // Default: next 12 months rolling, but clamp the upper bound so we never
  // overshoot the worksheet's data. If the AD's sheet only has games through
  // 2026, suggesting January-2027 open dates is noise — the user wouldn't be
  // scheduling against a year they don't have data for.
  const twelveMonthsLater = new Date(ref);
  twelveMonthsLater.setMonth(ref.getMonth() + 12);
  let endDate = twelveMonthsLater;
  if (worksheetYears && worksheetYears.size > 0) {
    const maxWSYear = Math.max(...worksheetYears);
    const endOfMaxWSYear = new Date(maxWSYear, 11, 31);
    if (endOfMaxWSYear < endDate) endDate = endOfMaxWSYear;
  }
  const start = new Date(today + "T00:00:00");
  return datesInRange(start, endDate);
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

  // ── Year/range hard filters ─────────────────────────────────────────────
  //
  // 1. If the user picked a specific year, HARD-FILTER to that year. No
  //    fudging — they clicked "2026" so they don't want 2027 dates.
  //    Safety net: if the filter wipes out every candidate (because the
  //    upstream candidate generator used a stale start/end from a different
  //    year), regenerate fresh from the target year so we never return
  //    "0 candidates" when the user has data in that year.
  // 2. Otherwise, if no explicit start/end either, fall back to the years
  //    actually represented on the worksheet (don't suggest dates from
  //    years the AD has no data for).
  if (query.dateRange?.year) {
    const targetYear = query.dateRange.year;
    const filtered = candidateDates.filter((d) => {
      const yr = parseInt(d.substring(0, 4), 10);
      return yr === targetYear;
    });

    if (filtered.length === 0) {
      // Rebuild from scratch using just the year + (optional) month.
      // Pass a stripped query so start/end can't pull us back to a wrong year.
      const fallbackQuery = {
        ...query,
        dateRange: {
          year: targetYear,
          month: query.dateRange.month,
          months: query.dateRange.months,
        },
      };
      candidateDates = generateCandidateDates(fallbackQuery, referenceDate, worksheetYears);
    } else {
      candidateDates = filtered;
    }
  } else if (
    worksheetYears.size > 0 &&
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
  /**
   * Build a "scan all games for open dates" result. Used in two places:
   *   1. When the user prompt mentions no team (query.targetTeams empty).
   *   2. As an automatic fallback when the team-specific path matches no
   *      games at all — the user typed e.g. "find open dates in february"
   *      and the AI hallucinated a team that doesn't exist on the sheet.
   *      Better to show "here are all open dates" than a confusing
   *      "no teams matched the prompt" error with zero results.
   */
  const runGlobalScan = (
    extraNote: string | null
  ): AvailableDatesResult => {
    const occupiedDates = extractAllOccupiedDates(gamesTable);
    const excludeDays = query.excludeDays ?? [];
    const minSpacing = query.minSpacing;
    const maxResults = query.maxResults ?? 50;

    const validCandidates = candidateDates.filter((d) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d)
    );

    let available = validCandidates.filter((d) => !occupiedDates.has(d));

    const excludedDayNames: string[] = [];
    if (excludeDays.length > 0) {
      excludedDayNames.push(...excludeDays.map((d) => WEEKDAY_NAMES_FULL[d]));
      available = available.filter(
        (d) => !excludeDays.includes(new Date(d + "T00:00:00").getDay())
      );
    }

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

    const notes: string[] = [];
    if (extraNote) notes.push(extraNote);
    if (excludedDayNames.length > 0)
      notes.push(`Excluded days: ${excludedDayNames.join(", ")}`);
    if (minSpacing && minSpacing > 0)
      notes.push(`Applied minimum ${minSpacing} day spacing`);
    notes.push(
      `Found ${recommendations.length} available dates (${weekdayCount} weekdays, ${recommendations.length - weekdayCount} weekends)`
    );

    return {
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
  };

  let serviceResult: AvailableDatesResult;

  if (query.targetTeams.length === 0) {
    // No team prompt → straight global scan.
    serviceResult = runGlobalScan(
      "No team specified — showing all open dates. Add a sport or level to narrow the results."
    );
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

    // ── Automatic fallback to global scan ────────────────────────────────
    //
    // When the prompt parsed to teams but NONE of those teams matched any
    // games on the worksheet (e.g. the user typed "find open dates in
    // february" and the AI hallucinated "BV Basketball" as a team), we used
    // to return zero results with "No teams matched the prompt". That's the
    // wrong UX — the user asked for open dates, so show open dates.
    //
    // We DON'T fall back when teams matched but happened to be fully booked.
    // That case is a real answer ("no openings for this team") that global
    // scan would obscure by showing dates conflicting with the actual team.
    const noMatchedTeams =
      (serviceResult.debug.matchedClusters?.length ?? 0) === 0;
    if (noMatchedTeams) {
      serviceResult = runGlobalScan(
        "No matching teams found for your prompt — showing all open dates in the requested range. Add a sport or level (e.g. \"Boys Varsity Basketball\") to narrow the results."
      );
    }
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
