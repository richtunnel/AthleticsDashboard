import { dateToLocalISO, lastDayOfMonth, monthNameToIndex } from "./normalizeDates";

export interface ResolvedRange {
  start: string;
  end: string;
  label: string;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() - d.getDay());
  return copy;
}

function isoRange(start: Date, end: Date, label: string): ResolvedRange {
  return { start: dateToLocalISO(start), end: dateToLocalISO(end), label };
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() + n);
  return copy;
}

function monthRange(year: number, monthIndex: number, label: string): ResolvedRange {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex, lastDayOfMonth(year, monthIndex));
  return isoRange(start, end, label);
}

const MONTH_DISPLAY_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function resolveRelativeDates(
  prompt: string,
  referenceDate?: Date
): ResolvedRange | null {
  const ref = referenceDate ?? new Date();
  const lower = prompt.toLowerCase();

  if (/\bthis\s+week\b/.test(lower)) {
    const sun = startOfWeek(ref);
    const sat = addDays(sun, 6);
    return isoRange(ref, sat, "this week");
  }

  if (/\bnext\s+week\b/.test(lower)) {
    const sun = addDays(startOfWeek(ref), 7);
    const sat = addDays(sun, 6);
    return isoRange(sun, sat, "next week");
  }

  if (/\bnext\s+weekend\b/.test(lower)) {
    const dow = ref.getDay();
    const daysUntilSat = (6 - dow + 7) % 7 || 7;
    const thisSat = addDays(ref, daysUntilSat);
    const nextSat = addDays(thisSat, 7);
    const nextSun = addDays(nextSat, 1);
    return isoRange(nextSat, nextSun, "next weekend");
  }

  if (/\bthis\s+weekend\b/.test(lower)) {
    const dow = ref.getDay();
    const daysUntilSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
    const sat = addDays(ref, daysUntilSat);
    const sun = addDays(sat, 1);
    return isoRange(sat, sun, "this weekend");
  }

  if (/\bthis\s+month\b/.test(lower)) {
    const end = new Date(ref.getFullYear(), ref.getMonth(), lastDayOfMonth(ref.getFullYear(), ref.getMonth()));
    return isoRange(ref, end, "this month");
  }

  if (/\bnext\s+month\b/.test(lower)) {
    const nm = ref.getMonth() + 1;
    const ny = nm > 11 ? ref.getFullYear() + 1 : ref.getFullYear();
    const nmi = nm % 12;
    return monthRange(ny, nmi, `next month (${MONTH_DISPLAY_NAMES[nmi]} ${ny})`);
  }

  if (/\bthis\s+summer\b/.test(lower)) {
    const year = ref.getMonth() >= 8 ? ref.getFullYear() + 1 : ref.getFullYear();
    return isoRange(new Date(year, 5, 1), new Date(year, 7, 31), `this summer (${year})`);
  }

  if (/\bthis\s+fall\b/.test(lower) || /\bthis\s+autumn\b/.test(lower)) {
    const year = ref.getMonth() >= 11 ? ref.getFullYear() + 1 : ref.getFullYear();
    return isoRange(new Date(year, 8, 1), new Date(year, 10, 30), `this fall (${year})`);
  }

  if (/\bthis\s+winter\b/.test(lower)) {
    const year = ref.getMonth() >= 2 ? ref.getFullYear() : ref.getFullYear() - 1;
    return isoRange(new Date(year, 11, 1), new Date(year + 1, 1, lastDayOfMonth(year + 1, 1)), `this winter (${year}–${year + 1})`);
  }

  if (/\bthis\s+spring\b/.test(lower)) {
    const year = ref.getMonth() >= 5 ? ref.getFullYear() + 1 : ref.getFullYear();
    return isoRange(new Date(year, 2, 1), new Date(year, 4, 31), `this spring (${year})`);
  }

  const nextMonthMatch = lower.match(/\bnext\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (nextMonthMatch) {
    const idx = monthNameToIndex(nextMonthMatch[1]);
    if (idx !== -1) {
      let year = ref.getFullYear();
      if (idx <= ref.getMonth()) year += 1;
      return monthRange(year, idx, `next ${MONTH_DISPLAY_NAMES[idx]} (${year})`);
    }
  }

  const inMonthMatch = lower.match(/\bin\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (inMonthMatch) {
    const idx = monthNameToIndex(inMonthMatch[1]);
    if (idx !== -1) {
      let year = ref.getFullYear();
      if (idx < ref.getMonth() || (idx === ref.getMonth() && ref.getDate() > 20)) {
        year += 1;
      }
      return monthRange(year, idx, `in ${MONTH_DISPLAY_NAMES[idx]} (${year})`);
    }
  }

  return null;
}
