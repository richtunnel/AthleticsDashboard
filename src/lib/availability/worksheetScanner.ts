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

export function generateCandidateDates(
  query: AvailabilityQuery,
  referenceDate?: Date
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

  function inferYear(monthIndex: number): number {
    if (dr?.year) return dr.year;
    const curYear = ref.getFullYear();
    const curMonth = ref.getMonth();
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

export async function scanWorksheet(opts: ScanOptions): Promise<ScanResult> {
  const { query, gamesTable, referenceDate } = opts;

  const candidateDates =
    opts.candidateDates && opts.candidateDates.length > 0
      ? opts.candidateDates
      : generateCandidateDates(query, referenceDate);

  const cleanPrompt = query.targetTeams
    .map((t) => `${t.gender ?? ""} ${t.level ?? ""} ${t.sport ?? ""}`.trim())
    .join(" ")
    .trim() || "unknown";

  const excludeTeamsPrompt =
    query.excludeTeams && query.excludeTeams.length > 0
      ? query.excludeTeams
          .map((t) => `${t.gender ?? ""} ${t.level ?? ""} ${t.sport ?? ""}`.trim())
          .join(" ")
      : undefined;

  const serviceResult = await availableDatesService.findAvailableDates(
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
