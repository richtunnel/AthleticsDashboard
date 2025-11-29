import canonicalSportsData from "@/lib/data/canonical-sports.json";

export interface SportLevelOption {
  label: string; // e.g., "Girls Varsity Basketball"
  sport: string; // e.g., "Basketball"
  gender: string; // e.g., "Girls"
  level: string; // e.g., "Varsity"
}

export function getSportLevelOptions(): SportLevelOption[] {
  const options: SportLevelOption[] = [];

  canonicalSportsData.sports.forEach((sport) => {
    sport.teams.forEach((team) => {
      options.push({
        label: `${team.gender} ${team.level} ${sport.name}`,
        sport: sport.name,
        gender: team.gender,
        level: team.level,
      });
    });
  });

  // Sort alphabetically by label
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function formatSportLevelLabel(sport: string | null, gender: string | null, level: string | null): string {
  if (!sport || !gender || !level) {
    return "All Sports";
  }
  return `${gender} ${level} ${sport}`;
}
