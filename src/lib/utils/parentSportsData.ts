/**
 * Shared sports and levels data for parent onboarding and settings dropdowns.
 */

export interface SportOption {
  id: string;
  name: string;
}

export interface LevelOption {
  id: string;
  name: string;
}

/** Comprehensive list of standard high school sports (NFHS + common state additions) */
export const ALL_HS_SPORTS: SportOption[] = [
  // Basketball
  { id: "Boys Basketball", name: "Boys Basketball" },
  { id: "Girls Basketball", name: "Girls Basketball" },
  // Baseball / Softball
  { id: "Baseball", name: "Baseball" },
  { id: "Softball", name: "Softball" },
  // Football
  { id: "Football", name: "Football" },
  { id: "Flag Football", name: "Flag Football" },
  // Soccer
  { id: "Boys Soccer", name: "Boys Soccer" },
  { id: "Girls Soccer", name: "Girls Soccer" },
  // Volleyball
  { id: "Boys Volleyball", name: "Boys Volleyball" },
  { id: "Girls Volleyball", name: "Girls Volleyball" },
  // Track & Field
  { id: "Boys Track & Field", name: "Boys Track & Field" },
  { id: "Girls Track & Field", name: "Girls Track & Field" },
  // Cross Country
  { id: "Boys Cross Country", name: "Boys Cross Country" },
  { id: "Girls Cross Country", name: "Girls Cross Country" },
  // Swimming & Diving
  { id: "Boys Swimming & Diving", name: "Boys Swimming & Diving" },
  { id: "Girls Swimming & Diving", name: "Girls Swimming & Diving" },
  // Tennis
  { id: "Boys Tennis", name: "Boys Tennis" },
  { id: "Girls Tennis", name: "Girls Tennis" },
  // Golf
  { id: "Boys Golf", name: "Boys Golf" },
  { id: "Girls Golf", name: "Girls Golf" },
  // Wrestling
  { id: "Boys Wrestling", name: "Boys Wrestling" },
  { id: "Girls Wrestling", name: "Girls Wrestling" },
  // Lacrosse
  { id: "Boys Lacrosse", name: "Boys Lacrosse" },
  { id: "Girls Lacrosse", name: "Girls Lacrosse" },
  // Water Polo
  { id: "Boys Water Polo", name: "Boys Water Polo" },
  { id: "Girls Water Polo", name: "Girls Water Polo" },
  // Ice Hockey
  { id: "Boys Ice Hockey", name: "Boys Ice Hockey" },
  { id: "Girls Ice Hockey", name: "Girls Ice Hockey" },
  // Field Hockey
  { id: "Field Hockey", name: "Field Hockey" },
  // Gymnastics
  { id: "Boys Gymnastics", name: "Boys Gymnastics" },
  { id: "Girls Gymnastics", name: "Girls Gymnastics" },
  // Badminton
  { id: "Boys Badminton", name: "Boys Badminton" },
  { id: "Girls Badminton", name: "Girls Badminton" },
  // Bowling
  { id: "Boys Bowling", name: "Boys Bowling" },
  { id: "Girls Bowling", name: "Girls Bowling" },
  // Cheer / Dance
  { id: "Cheerleading", name: "Cheerleading" },
  { id: "Dance Team", name: "Dance Team" },
  // Rowing
  { id: "Boys Rowing", name: "Boys Rowing" },
  { id: "Girls Rowing", name: "Girls Rowing" },
  // Skiing
  { id: "Boys Alpine Skiing", name: "Boys Alpine Skiing" },
  { id: "Girls Alpine Skiing", name: "Girls Alpine Skiing" },
  { id: "Boys Nordic Skiing", name: "Boys Nordic Skiing" },
  { id: "Girls Nordic Skiing", name: "Girls Nordic Skiing" },
  // Rugby
  { id: "Boys Rugby", name: "Boys Rugby" },
  { id: "Girls Rugby", name: "Girls Rugby" },
  // Other
  { id: "Fencing", name: "Fencing" },
  { id: "Equestrian", name: "Equestrian" },
  { id: "Boys Polo", name: "Boys Polo" },
  { id: "Girls Polo", name: "Girls Polo" },
];

/** Standard level display names in the correct order */
export const STANDARD_LEVELS: string[] = [
  "Varsity",
  "Junior Varsity",
  "Frosh",
  "Freshman",
  "Middle School",
];

/**
 * Merge a school-specific sports list from the API with the full static list.
 * School-specific sports appear first (they're confirmed to exist at the school),
 * then the remaining sports from the full list are appended alphabetically.
 */
export function mergeSports(apiSports: SportOption[]): SportOption[] {
  const apiNames = new Set(apiSports.map((s) => s.name.toLowerCase()));
  const extras = ALL_HS_SPORTS.filter((s) => !apiNames.has(s.name.toLowerCase()));
  return [...apiSports, ...extras].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Merge API-returned levels (normalized from DB values) with the standard fallback list.
 * API levels appear first; any standard levels not already included are appended.
 */
export function mergeLevels(apiLevels: LevelOption[]): LevelOption[] {
  const apiNames = new Set(apiLevels.map((l) => l.name.toLowerCase()));
  const extras = STANDARD_LEVELS.filter((l) => !apiNames.has(l.toLowerCase())).map(
    (l) => ({ id: l, name: l })
  );
  return [...apiLevels, ...extras];
}
