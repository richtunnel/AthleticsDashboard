import { AvailabilityQuery, ParseMethod } from "./types";
import { resolveRelativeDates } from "./resolveRelativeDates";
import { canonicalizeMonths, monthNameToIndex, monthIndexToName } from "./normalizeDates";
import { GENDER_ALIASES, LEVEL_ALIASES, COMPOUND_ABBREVIATIONS, buildSportDetectionRules } from "./sportTokens";

// Build once at module load — no need to rebuild per call.
const SPORT_DETECTION_RULES = buildSportDetectionRules();

const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const WEEKDAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ORDINAL_MAP: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  last: 5,
  fifth: 5,
  "5th": 5,
};

function parseWeekdayList(text: string): number[] {
  const days: number[] = [];
  const re = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue(?:s)?|wed|thu(?:rs?)?|fri|sat)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx = WEEKDAY_MAP[m[1].toLowerCase()];
    if (idx !== undefined && !days.includes(idx)) {
      days.push(idx);
    }
  }
  return days;
}

export function fallbackParse(prompt: string, opts?: { quotaExceeded?: boolean; referenceDate?: Date }): { query: AvailabilityQuery; method: ParseMethod } {
  const quotaExceeded = opts?.quotaExceeded ?? false;
  const lower = prompt.toLowerCase();

  // Stage 1: Relative dates
  let relativeRange: { start: string; end: string; label: string } | null = null;
  const hasExplicitRange = /\b(between|from)\b.+\b(and|to|–|-)\b/i.test(prompt);
  MONTH_RE.lastIndex = 0;

  if (!hasExplicitRange) {
    relativeRange = resolveRelativeDates(prompt, opts?.referenceDate);
  }

  // Stage 2: Explicit date range (e.g. "between May 12 and May 18" / "from X to Y")
  let explicitStart: string | undefined;
  let explicitEnd: string | undefined;

  const rangeRe =
    /(?:between|from)\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?)\s+(?:and|to|–|-)\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s*\d{4})?)/i;

  const rangeMatch = prompt.match(rangeRe);
  if (rangeMatch) {
    const ref = opts?.referenceDate ?? new Date();
    explicitStart = parseDatePhrase(rangeMatch[1], ref);
    explicitEnd = parseDatePhrase(rangeMatch[2], ref);
  }

  // Stage 3: Month filter
  const rawMonths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = MONTH_RE.exec(lower)) !== null) {
    rawMonths.push(m[1]);
  }
  MONTH_RE.lastIndex = 0;
  const foundMonths = canonicalizeMonths(rawMonths);

  // Cross-year inference for months
  let monthYear: number | undefined;
  if (foundMonths.length > 0 && !relativeRange && !explicitStart) {
    const ref = opts?.referenceDate ?? new Date();
    const curMonth = ref.getMonth();
    const curYear = ref.getFullYear();
    const allIndices = foundMonths.map((mn) => monthNameToIndex(mn));
    const allPast = allIndices.every((idx) => idx < curMonth);
    const inDecember = curMonth === 11;
    if (allPast || inDecember) {
      monthYear = curYear + 1;
    }
  }

  // Stage 4: Week-of-month
  let weekOfMonth: number | undefined;
  let weekOfMonthMonthOverride: string | undefined;

  const weekOfMonthRe =
    /\b(first|second|third|fourth|last|fifth|1st|2nd|3rd|4th|5th)\s+week\s+of\s+((?:next\s+month)|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))/i;
  const weekOfMonthMatch = prompt.match(weekOfMonthRe);
  if (weekOfMonthMatch) {
    const ordinal = weekOfMonthMatch[1].toLowerCase();
    weekOfMonth = ORDINAL_MAP[ordinal];
    const monthToken = weekOfMonthMatch[2].toLowerCase();
    if (monthToken === "next month") {
      if (!relativeRange) {
        relativeRange = resolveRelativeDates("next month", opts?.referenceDate);
      }
    } else {
      const idx = monthNameToIndex(monthToken);
      if (idx !== -1) {
        const ref = opts?.referenceDate ?? new Date();
        let yr = monthYear ?? ref.getFullYear();
        if (idx < ref.getMonth()) yr = ref.getFullYear() + 1;
        weekOfMonthMonthOverride = monthIndexToName(idx);
        monthYear = yr;
      }
    }
  }

  // Stage 5: Weekday inclusion
  let weekdaysToInclude: number[] | undefined;

  const isWeekendsOnly = /\bweekends?\s+only\b|\bonly\s+weekends?\b/i.test(lower);
  const isWeekdaysOnly = /\bno\s+weekends?\b|\bweekdays?\s+only\b|\bonly\s+weekdays?\b|mon(?:day)?\s*(?:through|to|thru|[-–])\s*fri(?:day)?/i.test(lower);

  if (isWeekendsOnly) {
    weekdaysToInclude = [0, 6];
  } else {
    const inclusionPatterns = [
      /\b(?:open|free|available|only|on)\s+((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue(?:s)?|wed|thu(?:rs?)?|fri|sat)s?\s*(?:,?\s*(?:and\s+)?)?)+)/gi,
      /\b((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue(?:s)?|wed|thu(?:rs?)?|fri|sat)s?\s*(?:,?\s*(?:and\s+)?)?){2,})only\b/gi,
      /\bonly\s+((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue(?:s)?|wed|thu(?:rs?)?|fri|sat)s?\s*(?:,?\s*(?:and\s+)?)?)+)/gi,
    ];

    for (const re of inclusionPatterns) {
      let im: RegExpExecArray | null;
      while ((im = re.exec(lower)) !== null) {
        const days = parseWeekdayList(im[1]);
        if (days.length > 0) {
          weekdaysToInclude = weekdaysToInclude ? [...new Set([...weekdaysToInclude, ...days])] : days;
        }
      }
    }

    const onDaysRe = /\bon\s+((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue(?:s)?|wed|thu(?:rs?)?|fri|sat)s?\s*(?:,?\s*(?:and\s+)?)?)+)/gi;
    let odm: RegExpExecArray | null;
    while ((odm = onDaysRe.exec(lower)) !== null) {
      const days = parseWeekdayList(odm[1]);
      if (days.length > 0) {
        weekdaysToInclude = weekdaysToInclude ? [...new Set([...weekdaysToInclude, ...days])] : days;
      }
    }

    const pluralDaysRe = /\b((?:(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s\s*(?:,?\s*(?:and\s+)?)?)+)\b/gi;
    let pdm: RegExpExecArray | null;
    while ((pdm = pluralDaysRe.exec(lower)) !== null) {
      const days = parseWeekdayList(pdm[1]);
      if (days.length > 0) {
        weekdaysToInclude = weekdaysToInclude ? [...new Set([...weekdaysToInclude, ...days])] : days;
      }
    }
  }

  // Stage 6: Weekday exclusions (only when not using inclusion)
  const excludeDays: number[] = [];
  if (!weekdaysToInclude && isWeekdaysOnly) {
    excludeDays.push(0, 6);
  } else if (!weekdaysToInclude) {
    if (/\bno\s+sun(?:days?)?\b/i.test(lower)) excludeDays.push(0);
    if (/\bno\s+mon(?:days?)?\b/i.test(lower)) excludeDays.push(1);
    if (/\bno\s+(?:tue|tues)(?:days?)?\b/i.test(lower)) excludeDays.push(2);
    if (/\bno\s+wed(?:nesdays?)?\b/i.test(lower)) excludeDays.push(3);
    if (/\bno\s+thu(?:rs(?:days?)?)?\b/i.test(lower)) excludeDays.push(4);
    if (/\bno\s+fri(?:days?)?\b/i.test(lower)) excludeDays.push(5);
    if (/\bno\s+sat(?:urdays?)?\b/i.test(lower)) excludeDays.push(6);
  }

  // Stage 7: Spacing
  const spacingMatch =
    lower.match(/(\d+)\s*days?\s*(?:apart|between|gap|spacing)/i) ?? lower.match(/at\s+least\s+(\d+)\s*days?/i) ?? lower.match(/every\s+(\d+)\s*days?/i) ?? lower.match(/(\d+)\s*day\s*minimum/i);
  const minSpacing = spacingMatch ? parseInt(spacingMatch[1], 10) : undefined;

  // Stage 8: Team extraction — derived from shared sportTokens alias tables.
  // Adding a new sport/gender/level/abbreviation only requires updating sportTokens.ts.
  let detectedGender: string | undefined;
  let detectedLevel: string | undefined;

  // Compound abbreviations set BOTH gender and level simultaneously and must
  // be checked before individual gender/level detection.
  for (const [abbrev, [g, l]] of Object.entries(COMPOUND_ABBREVIATIONS)) {
    if (new RegExp(`\\b${abbrev}\\b`, "i").test(lower)) {
      detectedGender = g;
      detectedLevel = l;
      break;
    }
  }

  // Individual gender detection (runs only if not already set by a compound abbrev).
  // Iterates GENDER_ALIASES in insertion order; first match wins.
  if (!detectedGender) {
    for (const [canonical, aliases] of Object.entries(GENDER_ALIASES)) {
      const pattern = new RegExp(`\\b(${(aliases as string[]).map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
      if (pattern.test(lower)) {
        detectedGender = canonical;
        break;
      }
    }
  }

  // Individual level detection.  LEVEL_ALIASES is ordered most-specific first
  // (e.g. "Junior Varsity" before "Varsity") to prevent short aliases matching
  // inside longer ones.
  if (!detectedLevel) {
    for (const [canonical, aliases] of Object.entries(LEVEL_ALIASES)) {
      // Sort aliases longest-first within each level for the same reason.
      const sorted = [...(aliases as string[])].sort((a, b) => b.length - a.length);
      const pattern = new RegExp(`\\b(${sorted.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
      if (pattern.test(lower)) {
        detectedLevel = canonical;
        break;
      }
    }
  }

  // Sport detection — SPORT_DETECTION_RULES is built once from SPORT_ALIASES at
  // module load.  Multi-word sports ("Cross Country", "Field Hockey") are handled
  // automatically because their aliases are sorted longest-first.
  let detectedSport: string | undefined;
  for (const [re, name] of SPORT_DETECTION_RULES) {
    if (re.test(lower)) {
      detectedSport = name;
      break;
    }
  }

  const targetTeams = detectedSport || detectedGender || detectedLevel ? [{ sport: detectedSport, gender: detectedGender, level: detectedLevel }] : [];

  // Stage 9: Build interpretation
  let interpretation: string;
  if (quotaExceeded) {
    interpretation = "Opletics is experiencing AI token usage at a high volume,";
  } else {
    const parts: string[] = ["Finding available dates"];
    const teamDesc = [detectedGender, detectedLevel, detectedSport].filter(Boolean).join(" ");
    if (teamDesc) parts.push(`for ${teamDesc}`);

    if (relativeRange) {
      parts.push(relativeRange.label);
    } else if (explicitStart && explicitEnd) {
      parts.push(`from ${explicitStart} to ${explicitEnd}`);
    } else if (weekOfMonth !== undefined) {
      const ordinalWords = ["", "first", "second", "third", "fourth", "fifth"];
      const monthLabel = weekOfMonthMonthOverride ?? (foundMonths[0] ? foundMonths[0] : "the month");
      parts.push(`in the ${ordinalWords[weekOfMonth] ?? weekOfMonth} week of ${monthLabel}`);
    } else if (foundMonths.length > 0) {
      const monthLabels = foundMonths.map((mn) => mn.charAt(0).toUpperCase() + mn.slice(1));
      parts.push(`in ${monthLabels.join(", ")}`);
    }

    if (weekdaysToInclude && weekdaysToInclude.length > 0) {
      const dayNames = weekdaysToInclude.map((d) => WEEKDAY_NAMES_FULL[d]);
      parts.push(`on ${dayNames.join(" and ")} only`);
    } else if (excludeDays.length > 0) {
      const dayNames = excludeDays.map((d) => WEEKDAY_NAMES_FULL[d]);
      parts.push(`excluding ${dayNames.join(", ")}`);
    }

    if (minSpacing) parts.push(`at least ${minSpacing} days apart`);

    interpretation = parts.join(", ").replace(/,\s*$/, "") + ".";
  }

  // Assemble dateRange
  const dateRangeObj: AvailabilityQuery["dateRange"] = {};
  let hasDateRange = false;

  if (relativeRange) {
    dateRangeObj.start = relativeRange.start;
    dateRangeObj.end = relativeRange.end;
    hasDateRange = true;
  } else if (explicitStart && explicitEnd) {
    dateRangeObj.start = explicitStart;
    dateRangeObj.end = explicitEnd;
    hasDateRange = true;
  }

  if (weekOfMonthMonthOverride) {
    dateRangeObj.month = weekOfMonthMonthOverride;
    if (monthYear) dateRangeObj.year = monthYear;
    hasDateRange = true;
  } else if (foundMonths.length > 1) {
    dateRangeObj.months = foundMonths;
    if (monthYear) dateRangeObj.year = monthYear;
    hasDateRange = true;
  } else if (foundMonths.length === 1) {
    dateRangeObj.month = foundMonths[0];
    if (monthYear) dateRangeObj.year = monthYear;
    hasDateRange = true;
  }

  if (weekOfMonth !== undefined) {
    dateRangeObj.weekOfMonth = weekOfMonth;
    hasDateRange = true;
  }

  const query: AvailabilityQuery = {
    targetTeams,
    excludeTeams: [],
    interpretation,
    quotaExceeded,
  };

  if (hasDateRange) query.dateRange = dateRangeObj;
  if (minSpacing) query.minSpacing = minSpacing;
  if (excludeDays.length > 0) query.excludeDays = excludeDays;
  if (weekdaysToInclude && weekdaysToInclude.length > 0) {
    query.weekdaysToInclude = weekdaysToInclude;
  }

  const method: ParseMethod = quotaExceeded ? "fallback-quota" : "fallback";
  return { query, method };
}

function parseDatePhrase(phrase: string, ref: Date): string {
  const monthRe =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i;
  const m = phrase.match(monthRe);
  if (!m) return phrase.trim();
  const monthIdx = monthNameToIndex(m[1]);
  const day = parseInt(m[2], 10);
  let year = m[3] ? parseInt(m[3], 10) : ref.getFullYear();
  if (!m[3] && monthIdx < ref.getMonth()) year += 1;
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
