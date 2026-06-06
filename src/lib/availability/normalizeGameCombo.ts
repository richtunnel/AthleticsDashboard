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
  if (/\bVARSITY\b/.test(t) || /\bVAR\b/.test(t))               return "VARSITY";
  // Single-letter "V" only after JV is already ruled out above
  if (/\bV\b/.test(t))                                           return "VARSITY";
  if (/\bFRESH(MAN|MEN)\b/.test(t))                             return "FRESHMAN";
  if (/\bMIDDLE\s+SCHOOL\b/.test(t))                            return "MIDDLE_SCHOOL";
  if (/\bSOPHOMORE\b/.test(t))                                   return "SOPHOMORE";
  return null;
}

function extractGenderFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bboys?\b/.test(t) || /\bmale\b/.test(t) || /\b(men|mens)\b/.test(t))        return "MALE";
  if (/\bgirls?\b/.test(t) || /\bfemale\b/.test(t) || /\b(women|womens)\b/.test(t)) return "FEMALE";
  // Single-letter abbreviations ("B V Basketball", "G V Soccer")
  if (/\bb\b/.test(t)) return "MALE";
  if (/\bg\b/.test(t)) return "FEMALE";
  return null;
}

function extractSportFromText(text: string): string {
  return text
    .replace(/\b(junior\s+varsity|varsity|j\.?v\.?|freshman|freshmen|middle\s+school|sophomore|v)\b/gi, "")
    .replace(/\b(boys?|girls?|male|female|men|womens?|coed|b|g)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || text.trim();
}

/**
 * Deep row scan: given all string cell values from a single game row,
 * score each by how many of {sport, level, gender} it encodes simultaneously.
 * Returns the highest-scoring extraction found.
 */
function deepRowScan(strings: string[]): { sport: string | null; level: string | null; gender: string | null } {
  type Hit = { sport: string | null; level: string | null; gender: string | null; score: number };

  let best: Hit = { sport: null, level: null, gender: null, score: 0 };

  for (const s of strings) {
    const rawSport  = extractSportFromText(s);
    const hasSport  = rawSport.toLowerCase() !== s.toLowerCase() && rawSport.length > 0;
    const rawLevel  = extractLevelFromText(s);
    const rawGender = extractGenderFromText(s);

    const score = (hasSport ? 1 : 0) + (rawLevel ? 1 : 0) + (rawGender ? 1 : 0);
    if (score > best.score) {
      best = {
        sport:  hasSport ? rawSport : null,
        level:  rawLevel,
        gender: rawGender,
        score,
      };
    }
  }

  return best;
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

  // Collect all non-empty string values for the deep scan
  const allStrings: string[] = Object.values(cf).filter(
    (v): v is string => typeof v === "string" && !!v.trim()
  );

  const dbSport  = game.homeTeam.sport.name;
  const dbLevel  = game.homeTeam.level;
  const dbGender = game.homeTeam.gender as string | null;

  // ── Sport ──────────────────────────────────────────────────────────────────
  let sport: string;
  if (colOverrides?.sport) {
    const raw = cfVal(colOverrides.sport) ?? "";
    sport = extractSportFromText(raw) || dbSport || "Unknown";
  } else if (dbSport && dbSport.toLowerCase() !== "general") {
    // Relational sport is meaningful — use it directly (no stripping needed)
    sport = dbSport;
  } else {
    // Try dedicated "Sport" column first — always strip gender/level from it
    const cfSport = cfVal("Sport") ?? cfVal("sport") ?? "";
    if (cfSport) {
      sport = extractSportFromText(cfSport) || dbSport || "Unknown";
    } else {
      // Deep scan: find the richest combined string containing sport info
      sport = deepRowScan(allStrings).sport ?? dbSport ?? "Unknown";
    }
  }

  // ── Level ──────────────────────────────────────────────────────────────────
  let level: string;
  if (colOverrides?.level) {
    const raw = cfVal(colOverrides.level) ?? "";
    level = extractLevelFromText(raw) ?? dbLevel ?? "VARSITY";
  } else if (dbLevel && !["VARSITY", ""].includes(dbLevel.toUpperCase())) {
    // Non-generic DB level — trust it
    level = dbLevel;
  } else {
    // Try dedicated "Level" column
    const cfLevel = cfVal("Level") ?? cfVal("level") ?? "";
    const levelFromCol = cfLevel ? extractLevelFromText(cfLevel) : null;
    if (levelFromCol) {
      level = levelFromCol;
    } else {
      // Deep scan: find level from any combined column
      // Also check the Sport column since CSVs often put "Girls Varsity Basketball" there
      const candidates = [
        cfVal("Sport") ?? "", cfVal("Team") ?? "",
        (game.homeTeam.name as string | null) ?? "",
        ...allStrings,
      ].filter(Boolean);
      const scanned = deepRowScan(candidates).level;
      level = scanned ?? dbLevel ?? "VARSITY";
    }
  }

  // ── Gender ─────────────────────────────────────────────────────────────────
  let gender: string;
  if (colOverrides?.gender) {
    const raw = cfVal(colOverrides.gender) ?? "";
    gender = extractGenderFromText(raw) ?? dbGender ?? "COED";
  } else if (dbGender && dbGender !== "COED") {
    gender = dbGender;
  } else {
    // 1. Dedicated gender columns
    const priorityKeys  = ["Gender", "Sex", "Division", "M/F", "gender", "sex"];
    const priorityValue = priorityKeys.map((k) => cfVal(k)).find(Boolean) ?? "";
    let detected        = extractGenderFromText(priorityValue);

    // 2. homeTeam.name and raw "Team" column
    if (!detected) {
      const teamName = (game.homeTeam.name as string | null) || cfVal("Team") || "";
      detected = extractGenderFromText(teamName);
    }

    // 3. Deep scan: find gender from any combined column value
    if (!detected) {
      // Check "Sport" column value first (most likely to have "Boys/Girls Basketball")
      const sportColVal = cfVal("Sport") ?? cfVal("sport") ?? "";
      if (sportColVal) detected = extractGenderFromText(sportColVal);
    }

    if (!detected) {
      const scanResult = deepRowScan(allStrings).gender;
      detected = scanResult;
    }

    gender = detected ?? dbGender ?? "COED";
  }

  return { sport, level, gender };
}

/** Combo key used for deduplication: "sport|level|gender" */
export function comboKey(sport: string, level: string, gender: string): string {
  return `${sport}|${level}|${gender}`;
}
