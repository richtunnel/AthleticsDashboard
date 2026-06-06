/**
 * Timezone-aware date and time formatters for the Schedule Exchange feature.
 *
 * IMPORTANT: always pass the Organization.timezone (e.g. "America/New_York")
 * so dates display correctly for the owning AD rather than in the viewer's
 * local timezone. Never display raw ISO strings or trailing Z literals.
 */

/** Format a full weekday + month + day + year label, e.g. "Monday, October 14, 2026" */
export const formatGameDate = (iso: string, tz: string): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(new Date(iso));

/** Format a 12-hour time label, e.g. "4:00 PM". Returns "Time TBD" when iso is null/undefined. */
export const formatGameTime = (iso: string | null | undefined, tz: string): string => {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(d);
};

/**
 * Short date label used in table rows, e.g. "Oct 14, 2026"
 */
export const formatGameDateShort = (iso: string, tz: string): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  }).format(new Date(iso));

/**
 * Day-of-week label, e.g. "Monday"
 */
export const formatDayOfWeek = (iso: string, tz: string): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: tz,
  }).format(new Date(iso));

/**
 * Polite card subject line.
 * e.g. "Jefferson High would like to compete on Monday, October 14, 2026 at 4:00 PM"
 */
export const gameRequestSubject = (
  schoolName: string,
  iso: string,
  tz: string
): string => {
  const date = formatGameDate(iso, tz);
  const time = formatGameTime(iso, tz);
  const timeStr = time === "Time TBD" ? "(time TBD)" : `at ${time}`;
  return `${schoolName} would like to compete on ${date} ${timeStr}`;
};

/**
 * Gender display label
 */
export const genderLabel = (gender: string | null | undefined): string => {
  if (!gender) return "Co-ed";
  switch (gender.toUpperCase()) {
    case "MALE":
    case "BOYS":
      return "Boys";
    case "FEMALE":
    case "GIRLS":
      return "Girls";
    default:
      return "Co-ed";
  }
};

/**
 * Human-readable sport/level/gender combo label — e.g. "Girls Varsity Tennis".
 *
 * Guards against double-prefixing: if the sport string already contains the
 * gender or level keywords (e.g. sport="Girls Varsity Basketball" because the
 * CSV stored the full string there), those parts are NOT prepended again.
 */
export const sportComboLabel = (sport: string, level: string, gender: string | null | undefined): string => {
  const g      = genderLabel(gender);
  const l      = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase().replace(/_/g, " ");
  const sLower = sport.toLowerCase();

  // Detect if the sport string already carries gender / level info
  const hasGender = g !== "Co-ed" && sLower.includes(g.toLowerCase());
  const hasLevel  = sLower.includes(l.toLowerCase());

  if (hasGender && hasLevel) return sport;                     // fully qualified already
  if (hasGender)             return `${l} ${sport}`;
  if (hasLevel)              return `${g} ${sport}`;
  return `${g} ${l} ${sport}`;
};
