import type { Gender } from "@prisma/client";

/**
 * Parse a free-form sport label into a normalised { baseSport, gender } pair.
 *
 * Examples:
 *   "Boys Basketball"    → { baseSport: "Basketball", gender: "MALE" }
 *   "Girls Volleyball"   → { baseSport: "Volleyball", gender: "FEMALE" }
 *   "Mens Soccer"        → { baseSport: "Soccer", gender: "MALE" }
 *   "Women's Tennis"     → { baseSport: "Tennis", gender: "FEMALE" }
 *   "B V Basketball"     → { baseSport: "Basketball", gender: "MALE" }
 *   "Coed Volleyball"    → { baseSport: "Volleyball", gender: "COED" }
 *   "Basketball"         → { baseSport: "Basketball", gender: null }
 *
 * The point: parents pick "Boys Basketball" in the UI, but the DB has
 * `Sport.name = "Basketball"` with `Team.gender = MALE`. Matching by the
 * raw label would always miss, so we strip the gender prefix and use it
 * separately for the Team query.
 */
export function parseSportLabel(input: string | null | undefined): {
  baseSport: string;
  gender: Gender | null;
} {
  if (!input) return { baseSport: "", gender: null };

  const lowered = input.toLowerCase().trim();

  // Order matters: longer/more-specific matches first so "boys" doesn't
  // accidentally match "boysoccer".
  //   B / G are common abbreviations on imported worksheets.
  const malePrefixes = /^(boys?|mens?|male|m|b)[\s.'-]+/;
  const femalePrefixes = /^(girls?|womens?|female|f|g|w)[\s.'-]+/;
  const coedPrefixes = /^(co[\s-]?ed|mixed|c)[\s.'-]+/;

  // Strip nested abbreviation tokens like "V" / "JV" / "Varsity" that some
  // worksheets put between gender and sport ("B V Basketball").
  const levelTokens = /^(v|jv|fr|frosh|varsity|junior\s*varsity|freshman|fresh)[\s.'-]+/;

  let m: RegExpMatchArray | null;

  if ((m = lowered.match(malePrefixes))) {
    let rest = lowered.slice(m[0].length);
    const lvl = rest.match(levelTokens);
    if (lvl) rest = rest.slice(lvl[0].length);
    return { baseSport: rest.trim() ? capitalize(rest) : input, gender: "MALE" };
  }
  if ((m = lowered.match(femalePrefixes))) {
    let rest = lowered.slice(m[0].length);
    const lvl = rest.match(levelTokens);
    if (lvl) rest = rest.slice(lvl[0].length);
    return { baseSport: rest.trim() ? capitalize(rest) : input, gender: "FEMALE" };
  }
  if ((m = lowered.match(coedPrefixes))) {
    const rest = lowered.slice(m[0].length);
    return { baseSport: rest.trim() ? capitalize(rest) : input, gender: "COED" };
  }

  return { baseSport: input.trim(), gender: null };
}

function capitalize(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normalise a free-form level string into a canonical token used for
 * case-insensitive Team.level matches.
 *
 *   "Varsity"          → "varsity"
 *   "VARSITY FEMALE"   → "varsity"   (gender stripped — that's tracked separately)
 *   "JV"               → "jv"
 *   "Junior Varsity"   → "jv"
 *   "Frosh"            → "frosh"
 *   "Freshman"         → "freshman"
 */
export function normaliseLevel(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();

  // Drop trailing gender markers some apps append ("VARSITY FEMALE")
  s = s.replace(/\s+(male|female|boys?|girls?|coed|mixed)\s*$/, "").trim();

  if (s === "junior varsity") return "jv";
  return s;
}
