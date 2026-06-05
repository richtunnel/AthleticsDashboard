/**
 * Normalizes sport / level / gender from a Game row regardless of whether
 * the data lives in the relational Team→Sport model or in the raw
 * customFields JSON that the CSV importer writes.
 *
 * Why this is needed:
 *   - CSV import maps the "Sport" column text ("Basketball") to the Team's
 *     sport relation. When the text doesn't match an existing Sport record
 *     the importer may fall back to a generic Sport named "General".
 *   - The raw CSV column values ARE reliably stored in game.customFields
 *     (e.g. { Sport: "Basketball", Level: "VARSITY", Team: "Tigers Boys Varsity" }).
 *   - We prefer the relational data when it's meaningful, fall back to
 *     customFields when the relational sport is "General" / blank.
 *
 * colOverrides lets callers map a specific customFields column key to each
 * field — useful when a single column (e.g. "Team" = "Boys Varsity Basketball")
 * encodes all three values and must be parsed rather than read directly.
 */

export interface ColOverrides {
  sport?:  string;   // customFields key whose value contains sport info
  level?:  string;   // customFields key whose value contains level info
  gender?: string;   // customFields key whose value contains gender info
}

// ── Text-parsing helpers used when a combined column covers multiple fields ─

function extractLevelFromText(text: string): string | null {
  const t = text.toUpperCase();
  if (/\bJUNIOR\s+VARSITY\b/.test(t) || /\bJ\.?V\.?\b/.test(t)) return "JV";
  if (/\bVARSITY\b/.test(t) || /\bVAR\b/.test(t))                return "VARSITY";
  if (/\bFRESH(MAN|MEN)\b/.test(t))                              return "FRESHMAN";
  if (/\bMIDDLE\s+SCHOOL\b/.test(t))                             return "MIDDLE_SCHOOL";
  if (/\bSOPHOMORE\b/.test(t))                                   return "SOPHOMORE";
  return null;
}

function extractGenderFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bboys?\b/.test(t) || /\bmale\b/.test(t) || /\b(men|mens)\b/.test(t))     return "MALE";
  if (/\bgirls?\b/.test(t) || /\bfemale\b/.test(t) || /\b(women|womens)\b/.test(t)) return "FEMALE";
  return null;
}

function extractSportFromText(text: string): string {
  return text
    .replace(/\b(junior\s+varsity|varsity|j\.?v\.?|freshman|freshmen|middle\s+school|sophomore)\b/gi, "")
    .replace(/\b(boys?|girls?|male|female|men|womens?|coed)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || text.trim();
}

export function normalizeGameCombo(
  game: {
    customFields?: unknown;
    customData?:   unknown;
    homeTeam: {
      name:   string | null;
      sport:  { name: string };
      level:  string;
      gender: string | null;
    };
  },
  colOverrides?: ColOverrides,
): { sport: string; level: string; gender: string } {
  const cf = (
    (game.customFields as Record<string, unknown>) ||
    (game.customData   as Record<string, unknown>) ||
    {}
  );

  const cfVal = (key: string): string | undefined =>
    (cf[key] ?? cf[key.toLowerCase()] ?? cf[key.toUpperCase()]) as string | undefined;

  // ── Sport ──────────────────────────────────────────────────────────────────
  const dbSport  = game.homeTeam.sport.name;
  let sport: string;
  if (colOverrides?.sport) {
    const raw = cfVal(colOverrides.sport) ?? "";
    sport = extractSportFromText(raw) || dbSport || "Unknown";
  } else {
    const cfSport = cfVal("Sport");
    sport = dbSport && dbSport.toLowerCase() !== "general"
      ? dbSport
      : cfSport || dbSport || "Unknown";
  }

  // ── Level ──────────────────────────────────────────────────────────────────
  const dbLevel = game.homeTeam.level;
  let level: string;
  if (colOverrides?.level) {
    const raw = cfVal(colOverrides.level) ?? "";
    level = extractLevelFromText(raw) ?? dbLevel ?? "VARSITY";
  } else {
    const cfLevel = cfVal("Level");
    level = dbLevel || cfLevel || "VARSITY";
  }

  // ── Gender ─────────────────────────────────────────────────────────────────
  const dbGender = game.homeTeam.gender as string | null;
  let gender: string;
  if (colOverrides?.gender) {
    const raw = cfVal(colOverrides.gender) ?? "";
    gender = extractGenderFromText(raw) ?? dbGender ?? "COED";
  } else if (dbGender && dbGender !== "COED") {
    // Relational gender is set and meaningful — trust it
    gender = dbGender;
  } else {
    // No reliable DB gender: do a broad scan across all customField values.
    //
    // Priority order:
    //  1. Dedicated gender columns (Gender, Sex, Division, M/F)
    //  2. The homeTeam.name stored in the DB
    //  3. Every other string value in customFields (Sport, Level, Team, etc.)
    //     — catches "Boys Varsity Basketball" wherever it lands in the CSV

    const priorityKeys  = ["Gender", "Sex", "Division", "M/F", "gender", "sex"];
    const priorityValue = priorityKeys.map((k) => cfVal(k)).find(Boolean) ?? "";
    let detected        = extractGenderFromText(priorityValue);

    if (!detected) {
      // Check homeTeam.name and the raw "Team" column
      const teamName = (game.homeTeam.name as string | null) || cfVal("Team") || "";
      detected = extractGenderFromText(teamName);
    }

    if (!detected) {
      // Scan every remaining string cell value — last resort
      for (const val of Object.values(cf)) {
        if (typeof val === "string" && val) {
          detected = extractGenderFromText(val);
          if (detected) break;
        }
      }
    }

    gender = detected ?? dbGender ?? "COED";
  }

  return { sport, level, gender };
}

/** Combo key used for deduplication: "sport|level|gender" */
export function comboKey(sport: string, level: string, gender: string): string {
  return `${sport}|${level}|${gender}`;
}
