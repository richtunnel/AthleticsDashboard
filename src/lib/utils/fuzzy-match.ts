import { prisma } from "@/lib/database/prisma";

/**
 * Fuzzy matching utility for matching parent sport/level requests
 * against AD spreadsheet column values and team data.
 */

// Known level aliases for fuzzy matching
const LEVEL_ALIASES: Record<string, string[]> = {
  varsity: ["varsity", "v"],
  "junior varsity": ["junior varsity", "jv", "j.v.", "jr varsity", "jr. varsity"],
  freshman: ["freshman", "frosh", "9th grade", "9th"],
  "middle school": ["middle school", "ms", "junior high", "jh"],
  youth: ["youth"],
};

export interface MatchSuggestion {
  columnName: string;
  columnValue: string;
  score: number;
  source: "customFields" | "team";
}

/**
 * Normalize a string for comparison: trim, collapse whitespace, lowercase.
 * Matches the convention in google-calendar-sync.ts.
 */
export function normalize(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Tokenize a string into lowercase words.
 */
function tokenize(input: string): string[] {
  return normalize(input).split(" ").filter(Boolean);
}

/**
 * Check if a level string matches another using aliases.
 * Returns 1.0 for exact/alias match, 0.0 for no match.
 */
function matchLevel(parentLevel: string, candidateValue: string): number {
  const normParent = normalize(parentLevel);
  const normCandidate = normalize(candidateValue);

  // Direct containment
  if (normCandidate.includes(normParent)) return 1.0;
  if (normParent.includes(normCandidate)) return 1.0;

  // Check aliases: find which alias group the parent level belongs to
  for (const [, aliases] of Object.entries(LEVEL_ALIASES)) {
    const parentInGroup = aliases.some(
      (a) => normalize(a) === normParent || normParent.includes(normalize(a))
    );
    if (parentInGroup) {
      // Check if any alias from the same group appears in the candidate
      const candidateMatches = aliases.some((a) =>
        normCandidate.includes(normalize(a))
      );
      if (candidateMatches) return 1.0;
    }
  }

  // Token overlap: check if any level token appears
  const parentTokens = tokenize(parentLevel);
  const candidateTokens = tokenize(candidateValue);
  const overlap = parentTokens.filter((t) => candidateTokens.includes(t));
  if (overlap.length > 0) return 0.5;

  return 0.0;
}

/**
 * Score how well a candidate value matches a parent's sport and level.
 * Returns a score between 0 and 1.
 *
 * - sportScore: 1.0 if parent sport name is a substring of candidate
 * - levelScore: 1.0 for exact/alias match, 0.5 for partial token overlap
 * - combined = sportScore * 0.6 + levelScore * 0.4
 */
export function scoreSportMatch(
  parentSport: string,
  parentLevel: string,
  candidateValue: string
): number {
  const normSport = normalize(parentSport);
  const normCandidate = normalize(candidateValue);

  // Sport must appear as substring
  const sportScore = normCandidate.includes(normSport) ? 1.0 : 0.0;

  // Level matching with aliases
  const levelScore = parentLevel ? matchLevel(parentLevel, candidateValue) : 0.5;

  return sportScore * 0.6 + levelScore * 0.4;
}

/**
 * Find the best matching candidates from a list, sorted by score descending.
 */
export function findBestMatches(
  parentSport: string,
  parentLevel: string,
  candidates: { columnName: string; columnValue: string; source: "customFields" | "team" }[]
): MatchSuggestion[] {
  const scored = candidates.map((c) => ({
    ...c,
    score: scoreSportMatch(parentSport, parentLevel, c.columnValue),
  }));

  // Filter to candidates with at least some sport match (score >= 0.6)
  return scored
    .filter((s) => s.score >= 0.4)
    .sort((a, b) => b.score - a.score);
}

/**
 * Generate auto-suggestions for a parent's sport/level request
 * by gathering candidates from Game customFields and Team records.
 */
export async function generateAutoSuggestions(
  parentSport: string,
  parentLevel: string,
  organizationId: string
): Promise<MatchSuggestion[]> {
  const candidates: {
    columnName: string;
    columnValue: string;
    source: "customFields" | "team";
  }[] = [];

  // 1. Gather distinct customField values from Games in this organization
  try {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
      },
      select: { customFields: true },
      take: 500,
    });

    const seenValues = new Set<string>();
    for (const game of games) {
      const cf = game.customFields as Record<string, unknown> | null;
      if (!cf) continue;
      for (const [colName, colValue] of Object.entries(cf)) {
        if (typeof colValue !== "string" || !colValue.trim()) continue;
        const key = `${colName}::${colValue}`;
        if (seenValues.has(key)) continue;
        seenValues.add(key);
        candidates.push({
          columnName: colName,
          columnValue: colValue,
          source: "customFields",
        });
      }
    }
  } catch (error) {
    console.error("[fuzzy-match] Error fetching game customFields:", error);
  }

  // 2. Gather Team + Sport combinations
  try {
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
    });

    const seenTeams = new Set<string>();
    for (const team of teams) {
      // Build candidate like "Varsity Basketball" or team name
      const combinedValue = `${team.level} ${team.sport.name}`;
      if (!seenTeams.has(combinedValue)) {
        seenTeams.add(combinedValue);
        candidates.push({
          columnName: "Team/Sport",
          columnValue: combinedValue,
          source: "team",
        });
      }
      // Also add the team name itself
      if (!seenTeams.has(team.name)) {
        seenTeams.add(team.name);
        candidates.push({
          columnName: "Team",
          columnValue: team.name,
          source: "team",
        });
      }
    }
  } catch (error) {
    console.error("[fuzzy-match] Error fetching teams:", error);
  }

  return findBestMatches(parentSport, parentLevel, candidates);
}
