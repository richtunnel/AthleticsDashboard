/**
 * sportTokens.ts
 *
 * Single source of truth for sport / gender / level aliases and pattern
 * generation. Both the prompt parser (fallbackParser) and the game-row
 * matcher (available-dates.service) derive their knowledge exclusively
 * from the tables here.
 *
 * ─── How to extend ───────────────────────────────────────────────────────────
 *  • New sport       → add an entry to SPORT_ALIASES
 *  • New gender term → add an alias to GENDER_ALIASES
 *  • New level       → add an entry to LEVEL_ALIASES (more-specific entries
 *                       must come before shorter ones, e.g. "Junior Varsity"
 *                       before "Varsity")
 *  • New combined    → add an entry to COMPOUND_ABBREVIATIONS
 *
 * No other file needs to be touched.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Gender ────────────────────────────────────────────────────────────────────

export const GENDER_ALIASES: Record<string, readonly string[]> = {
  Boys:  ["boys", "boy", "b", "male", "m", "men", "man", "mens"],
  Girls: ["girls", "girl", "g", "female", "f", "women", "woman", "womens", "ladies", "lady"],
  Coed:  ["coed", "co-ed", "mixed", "open"],
};

// ── Level ─────────────────────────────────────────────────────────────────────
//
// IMPORTANT: more-specific entries must appear BEFORE less-specific ones that
// share a substring (e.g. "Junior Varsity" before "Varsity", "Frosh-Soph"
// before "Freshmen").  Iteration order (insertion order) is relied upon in
// fallbackParser and the deriveAbbreviationMap utility.

export const LEVEL_ALIASES: Record<string, readonly string[]> = {
  "Junior Varsity": [
    "junior varsity", "junior var", "junior v",
    "jv", "j.v.", "jr varsity", "jr var", "jr v", "jr",
  ],
  "Varsity": ["varsity", "var", "v"],
  "Frosh-Soph": [
    "frosh-soph", "frosh soph", "frosh/soph", "f/s", "fs", "soph",
  ],
  "Freshmen": ["freshmen", "freshman", "frosh", "fresh", "9th"],
  "Middle School": ["middle school", "middle", "ms"],
  "Youth": ["youth"],
};

// ── Sport ─────────────────────────────────────────────────────────────────────
//
// Multi-word sport names should have the full phrase as the FIRST alias so
// the longest-match sort in buildSportDetectionRules picks it up first.

export const SPORT_ALIASES: Record<string, readonly string[]> = {
  "Basketball":        ["basketball", "bball", "bb"],
  "Football":          ["football", "fb"],
  "Soccer":            ["soccer"],
  "Volleyball":        ["volleyball", "vball", "vb"],
  "Baseball":          ["baseball"],
  "Softball":          ["softball", "sb"],
  "Tennis":            ["tennis"],
  "Golf":              ["golf"],
  "Swimming":          ["swimming", "swim"],
  "Track":             ["track"],
  "Cross Country":     ["cross country", "cross-country", "xc", "x-c"],
  "Lacrosse":          ["lacrosse"],
  "Wrestling":         ["wrestling"],
  "Gymnastics":        ["gymnastics"],
  "Badminton":         ["badminton"],
  "Cheerleading":      ["cheerleading", "cheer"],
  "Field Hockey":      ["field hockey", "field-hockey"],
  "Water Polo":        ["water polo", "water-polo"],
  "Swimming & Diving": ["swimming & diving", "swimming and diving", "swim & dive"],
  "Track & Field":     ["track & field", "track and field"],
};

// ── Compound abbreviations ────────────────────────────────────────────────────
//
// Abbreviations that encode gender + level simultaneously.  Values are
// [canonical-gender, canonical-level] in their capitalised forms so callers
// can use them directly without further lookup.

export const COMPOUND_ABBREVIATIONS: Record<string, readonly [string, string]> = {
  bv:  ["Boys",  "Varsity"],
  gv:  ["Girls", "Varsity"],
  bjv: ["Boys",  "Junior Varsity"],
  gjv: ["Girls", "Junior Varsity"],
  bfs: ["Boys",  "Frosh-Soph"],
  gfs: ["Girls", "Frosh-Soph"],
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Pattern generation ────────────────────────────────────────────────────────

/**
 * Build every known phrase pattern for a (gender × level × sport) triple.
 *
 * Returns lowercase patterns ready for substring search against a lowercased
 * searchable row string.  Covers:
 *   • Full phrase        "boys varsity basketball"
 *   • Abbrev level       "boys jv basketball", "boys var bball"
 *   • Abbrev gender      "b varsity basketball", "g var soccer"
 *   • Compact form       "bv basketball", "gv bball", "b v basketball"
 *   • Compound abbrev    "bv basketball" (via COMPOUND_ABBREVIATIONS)
 *
 * Pre-building with this function before the row loop is important —
 * call it once per cluster, not once per row.
 */
export function buildTeamPatterns(
  gender: string,
  level: string,
  sport: string
): readonly string[] {
  const gAliases = (GENDER_ALIASES[gender] ?? [gender.toLowerCase()]) as string[];
  const lAliases = (LEVEL_ALIASES[level]   ?? [level.toLowerCase()])   as string[];
  const sAliases = (SPORT_ALIASES[sport]   ?? [sport.toLowerCase()])   as string[];

  const patterns = new Set<string>();

  // Full triplet — every gender alias × every level alias × every sport alias
  for (const g of gAliases) {
    for (const l of lAliases) {
      for (const s of sAliases) {
        patterns.add(`${g} ${l} ${s}`);
      }
    }
  }

  // Compact two-token form: single-char gender + short level abbrev + sport alias
  // e.g. "bv basketball", "gv bball", "b v basketball"
  const gInits = gAliases.filter((a) => a.length === 1);  // "b", "g"
  const lShort = lAliases.filter((a) => a.length <= 3);   // "v", "jv", "var"
  for (const gi of gInits) {
    for (const li of lShort) {
      for (const s of sAliases) {
        patterns.add(`${gi}${li} ${s}`);   // "bv basketball"
        patterns.add(`${gi} ${li} ${s}`);  // "b v basketball"
      }
    }
  }

  // Compound abbreviation → sport alias pairs
  for (const [abbrev, [cg, cl]] of Object.entries(COMPOUND_ABBREVIATIONS)) {
    if (cg === gender && cl === level) {
      for (const s of sAliases) {
        patterns.add(`${abbrev} ${s}`);
      }
    }
  }

  return Array.from(patterns);
}

// ── Text detection helpers ────────────────────────────────────────────────────

/**
 * Returns true if the canonical gender (e.g. "Boys") is detectable in `text`
 * using ANY known alias with word-boundary matching.
 * Handles "male", "men", "b", "ladies", etc. automatically.
 */
export function genderInText(canonical: string, text: string): boolean {
  const aliases = (GENDER_ALIASES[canonical] ?? [canonical.toLowerCase()]) as string[];
  return aliases.some((a) =>
    new RegExp(`\\b${escapeRegex(a)}\\b`, "i").test(text)
  );
}

/**
 * Returns true if the canonical level (e.g. "Junior Varsity") is detectable
 * in `text` using ANY known alias.
 *
 * Special guard for "Varsity": its aliases ("varsity", "var", "v") are all
 * substrings of "Junior Varsity" aliases.  We reject a Varsity match whenever
 * the text already contains a more-specific Junior Varsity alias, so that a
 * "Varsity" cluster never accidentally absorbs JV rows.
 */
export function levelInText(canonical: string, text: string): boolean {
  const aliases = (LEVEL_ALIASES[canonical] ?? [canonical.toLowerCase()]) as string[];
  const lower = text.toLowerCase();

  if (canonical === "Varsity") {
    const jvAliases = LEVEL_ALIASES["Junior Varsity"] as readonly string[];
    // If the text contains ANY Junior Varsity alias, it is describing JV — not plain Varsity.
    if (jvAliases.some((jva) => lower.includes(jva))) {
      return false;
    }
  }

  return aliases.some((a) => lower.includes(a));
}

/**
 * Returns true if the canonical sport (e.g. "Basketball") is detectable in
 * `text` using ANY known alias.
 */
export function sportInText(canonical: string, text: string): boolean {
  const aliases = (SPORT_ALIASES[canonical] ?? [canonical.toLowerCase()]) as string[];
  const lower = text.toLowerCase();
  return aliases.some((a) => lower.includes(a));
}

// ── ABBREVIATION_MAP derivation (for prompt tokenisation) ────────────────────

/**
 * Derives the token-expansion map used by the prompt tokenizer in
 * available-dates.service.ts.
 *
 * Maps any known alias or compound abbreviation → array of canonical lowercase
 * tokens suitable for scoring against canonical sports data.
 *
 * Priority (first writer wins):
 *   1. Compound abbreviations  ("bv" → ["boys", "varsity"])
 *   2. Gender aliases          ("male" → ["boys"])
 *   3. Level aliases           ("jv"  → ["junior", "varsity"])
 *   4. Sport aliases           ("bb"  → ["basketball"])
 */
export function deriveAbbreviationMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  // 1. Compound abbreviations
  for (const [abbrev, [g, l]] of Object.entries(COMPOUND_ABBREVIATIONS)) {
    map[abbrev] = [g.toLowerCase(), ...l.toLowerCase().split(/\s+/)];
    // "bv"  → ["boys", "varsity"]
    // "bjv" → ["boys", "junior", "varsity"]
  }

  // 2. Gender aliases → single canonical token
  for (const [canonical, aliases] of Object.entries(GENDER_ALIASES)) {
    for (const alias of aliases as string[]) {
      if (!map[alias]) map[alias] = [canonical.toLowerCase()];
    }
  }

  // 3. Level aliases → canonical level split into tokens
  //    "jv" → "Junior Varsity" → ["junior", "varsity"] (matches scoreMatch's split logic)
  for (const [canonical, aliases] of Object.entries(LEVEL_ALIASES)) {
    const tokens = canonical.toLowerCase().split(/\s+/);
    for (const alias of aliases as string[]) {
      if (!map[alias]) map[alias] = tokens;
    }
  }

  // 4. Sport aliases → canonical sport name split into word tokens
  //    "xc" → "Cross Country" → ["cross", "country"]
  //    "bb" → "Basketball"    → ["basketball"]
  for (const [canonical, aliases] of Object.entries(SPORT_ALIASES)) {
    const tokens = canonical.toLowerCase().replace(/[&]/g, "").split(/\s+/).filter(Boolean);
    for (const alias of aliases as string[]) {
      if (!map[alias]) map[alias] = tokens;
    }
  }

  return map;
}

// ── Sport detection rules (for prompt parser) ─────────────────────────────────

/**
 * Build [regex, sportName] pairs for natural-language sport detection.
 * Used by the fallback parser (Stage 8).
 *
 * Aliases within each sport are sorted longest-first so multi-word phrases
 * ("cross country", "field hockey") match before shorter overlapping tokens.
 *
 * Cache the result at module level — there is no need to rebuild per call.
 */
export function buildSportDetectionRules(): Array<[RegExp, string]> {
  return Object.entries(SPORT_ALIASES).map(([name, aliases]) => {
    const sorted = [...(aliases as string[])].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      `\\b(${sorted.map(escapeRegex).join("|")})\\b`,
      "i"
    );
    return [pattern, name] as [RegExp, string];
  });
}

// ── Canonical lookup helpers ──────────────────────────────────────────────────

/** Given any gender alias string, return the canonical gender or null. */
export function canonicalGender(alias: string): string | null {
  const lower = alias.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(GENDER_ALIASES)) {
    if ((aliases as string[]).includes(lower)) return canonical;
  }
  return null;
}

/** Given any level alias string, return the canonical level or null. */
export function canonicalLevel(alias: string): string | null {
  const lower = alias.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(LEVEL_ALIASES)) {
    if ((aliases as string[]).includes(lower)) return canonical;
  }
  return null;
}
