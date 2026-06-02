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
 */
export function normalizeGameCombo(game: {
  customFields?: unknown;
  customData?:   unknown;
  homeTeam: {
    name:   string | null;
    sport:  { name: string };
    level:  string;
    gender: string | null;
  };
}): { sport: string; level: string; gender: string } {
  const cf = (
    (game.customFields as Record<string, unknown>) ||
    (game.customData   as Record<string, unknown>) ||
    {}
  );

  // ── Sport ──────────────────────────────────────────────────────────────────
  const dbSport = game.homeTeam.sport.name;
  const cfSport = (cf["Sport"] || cf["sport"]) as string | undefined;
  const sport =
    dbSport && dbSport.toLowerCase() !== "general"
      ? dbSport
      : cfSport || dbSport || "Unknown";

  // ── Level ──────────────────────────────────────────────────────────────────
  const dbLevel = game.homeTeam.level;
  const cfLevel = (cf["Level"] || cf["level"]) as string | undefined;
  const level = dbLevel || cfLevel || "VARSITY";

  // ── Gender ─────────────────────────────────────────────────────────────────
  // Priority: relational gender enum  →  parse team name  →  COED fallback
  const dbGender = game.homeTeam.gender as string | null;
  const teamName =
    (game.homeTeam.name as string | null) ||
    (cf["Team"] as string | undefined) ||
    (cf["team"] as string | undefined) ||
    "";

  let gender: string;
  if (dbGender) {
    gender = dbGender;
  } else if (/boys/i.test(teamName)) {
    gender = "MALE";
  } else if (/girls/i.test(teamName)) {
    gender = "FEMALE";
  } else {
    gender = "COED";
  }

  return { sport, level, gender };
}

/** Combo key used for deduplication: "sport|level|gender" */
export function comboKey(sport: string, level: string, gender: string): string {
  return `${sport}|${level}|${gender}`;
}
