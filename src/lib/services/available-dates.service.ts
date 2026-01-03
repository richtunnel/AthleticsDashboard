import canonicalSportsData from "../data/canonical-sports.json";

// Abbreviation map for prompt parsing
const ABBREVIATION_MAP: Record<string, string[]> = {
  // Genders
  'b': ['boys'],
  'g': ['girls'],
  'coed': ['coed'],
  
  // Levels
  'v': ['varsity'],
  'var': ['varsity'],
  'varsity': ['varsity'],
  'jv': ['junior', 'varsity'],
  'jr': ['junior', 'varsity'],
  'junior': ['junior', 'varsity'],
  'fs': ['frosh', 'soph'],
  'frosh': ['freshmen'],
  'freshman': ['freshmen'],
  'freshmen': ['freshmen'],
  
  // Combined
  'bv': ['boys', 'varsity'],
  'gv': ['girls', 'varsity'],
  
  // Sports
  'bb': ['basketball'],
  'bball': ['basketball'],
  'fb': ['football'],
  'sb': ['softball'],
};

interface CanonicalTeam {
  sport: string;
  gender: string;
  level: string;
  score: number;
}

interface ClusterMatch {
  sport: string;
  gender: string;
  level: string;
  confidence: number;
}

interface GameRow {
  date?: string | Date | null;
  sport?: string | null;
  level?: string | null;
  gender?: string | null;
  team?: string | null;
  description?: string | null;
  title?: string | null;
  [key: string]: any;
}

export interface AvailableDatesResult {
  recommendations: string[]; // ISO date strings
  debug: {
    parsedTokens: string[];
    matchedClusters: ClusterMatch[];
    clusterDates: string[];
    excludedClusters?: ClusterMatch[]; // Teams whose dates should be avoided
    excludedClusterDates?: string[]; // Dates to avoid based on excluded teams
    notes: string[];
    excludedDays?: string[]; // Days of week excluded (e.g., ["Sunday", "Saturday"])
    dateRange?: { start?: string; end?: string; month?: string }; // Applied date range filter
    minSpacing?: number; // Applied minimum spacing constraint
  };
}

export class AvailableDatesService {
  /**
   * Main entry point: Find available dates from candidate pool
   */
  async findAvailableDates(
    prompt: string,
    gamesTable: GameRow[],
    candidateDates: string[],
    options?: { 
      maxResults?: number; 
      threshold?: number; 
      excludeDays?: number[];
      excludeTeamsPrompt?: string; // Teams whose dates should be avoided
      dateRange?: { start?: string; end?: string; month?: string }; // Date range filter
      minSpacing?: number; // Minimum days between dates
    }
  ): Promise<AvailableDatesResult> {
    const maxResults = options?.maxResults || 10; // Default 10 results, user can select 25 or 50
    const threshold = options?.threshold || 2.5;
    const excludeDays = options?.excludeDays || []; // Days of week to exclude (0=Sunday, 6=Saturday)
    const excludeTeamsPrompt = options?.excludeTeamsPrompt;
    const dateRange = options?.dateRange;
    const minSpacing = options?.minSpacing;
    
    const debug = {
      parsedTokens: [] as string[],
      matchedClusters: [] as ClusterMatch[],
      clusterDates: [] as string[],
      excludedClusters: [] as ClusterMatch[],
      excludedClusterDates: [] as string[],
      notes: [] as string[],
      excludedDays: [] as string[],
      dateRange,
      minSpacing,
    };

    // Validate candidateDates
    if (!candidateDates || candidateDates.length === 0) {
      debug.notes.push('Error: candidateDates required');
      return { recommendations: [], debug };
    }

    // Validate candidateDates format (ISO YYYY-MM-DD)
    const validCandidates = candidateDates.filter(dateStr => {
      const match = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
      if (!match) {
        debug.notes.push(`Invalid date format: ${dateStr}`);
      }
      return match;
    });

    if (validCandidates.length === 0) {
      debug.notes.push('Error: No valid candidate dates (expected ISO YYYY-MM-DD)');
      return { recommendations: [], debug };
    }

    // Step 1: Parse prompt and expand abbreviations
    const parsedTokens = this.parsePrompt(prompt);
    debug.parsedTokens = parsedTokens;

    // Step 2: Match against canonical sports
    const matchedClusters = this.matchClusters(parsedTokens, threshold);
    debug.matchedClusters = matchedClusters.map(c => ({
      sport: c.sport,
      gender: c.gender,
      level: c.level,
      confidence: c.score,
    }));

    if (matchedClusters.length === 0) {
      debug.notes.push('No teams matched the prompt');
      return { recommendations: [], debug };
    }

    // Step 3: Handle excluded teams (if provided)
    let excludedClusterDates = new Set<string>();
    if (excludeTeamsPrompt) {
      const excludedParsedTokens = this.parsePrompt(excludeTeamsPrompt);
      const excludedClusters = this.matchClusters(excludedParsedTokens, threshold);
      debug.excludedClusters = excludedClusters.map(c => ({
        sport: c.sport,
        gender: c.gender,
        level: c.level,
        confidence: c.score,
      }));
      
      if (excludedClusters.length > 0) {
        excludedClusterDates = this.extractClusterDates(gamesTable, excludedClusters, debug);
        debug.excludedClusterDates = Array.from(excludedClusterDates).sort();
        debug.notes.push(`Excluding ${excludedClusterDates.size} dates from: ${excludedClusters.map(c => `${c.gender} ${c.level} ${c.sport}`).join(', ')}`);
      }
    }

    // Step 4: Extract cluster dates from games table
    const clusterDates = this.extractClusterDates(gamesTable, matchedClusters, debug);
    debug.clusterDates = Array.from(clusterDates).sort();

    // Step 5: Filter candidateDates - remove dates with conflicts
    let availableDates = validCandidates.filter(date => !clusterDates.has(date) && !excludedClusterDates.has(date));
    
    if (availableDates.length === 0) {
      debug.notes.push('All candidate dates are blocked by existing games');
      return { recommendations: [], debug };
    }

    // Step 6: Apply date range filter if provided
    if (dateRange) {
      const beforeRangeCount = availableDates.length;
      
      availableDates = availableDates.filter(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        
        // Filter by month if specified
        if (dateRange.month) {
          const monthNames = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
          ];
          const targetMonthIndex = monthNames.indexOf(dateRange.month.toLowerCase());
          if (targetMonthIndex !== -1 && date.getMonth() !== targetMonthIndex) {
            return false;
          }
        }
        
        // Filter by start date if specified
        if (dateRange.start) {
          const startDate = new Date(dateRange.start + 'T00:00:00');
          if (date < startDate) {
            return false;
          }
        }
        
        // Filter by end date if specified
        if (dateRange.end) {
          const endDate = new Date(dateRange.end + 'T00:00:00');
          if (date > endDate) {
            return false;
          }
        }
        
        return true;
      });
      
      const filteredCount = beforeRangeCount - availableDates.length;
      if (filteredCount > 0) {
        const rangeDesc = dateRange.month ? `month: ${dateRange.month}` : 
                         `${dateRange.start || 'start'} to ${dateRange.end || 'end'}`;
        debug.notes.push(`Filtered ${filteredCount} dates outside range (${rangeDesc})`);
      }
      
      if (availableDates.length === 0) {
        debug.notes.push('No dates available in specified date range');
        return { recommendations: [], debug };
      }
    }

    // Step 7: Filter out excluded days of week
    if (excludeDays.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      debug.excludedDays = excludeDays.map(d => dayNames[d]);
      
      const beforeCount = availableDates.length;
      availableDates = availableDates.filter(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = date.getDay();
        return !excludeDays.includes(dayOfWeek);
      });
      
      const excludedCount = beforeCount - availableDates.length;
      if (excludedCount > 0) {
        debug.notes.push(`Excluded ${excludedCount} dates on: ${debug.excludedDays.join(', ')}`);
      }
      
      if (availableDates.length === 0) {
        debug.notes.push('All available dates were excluded by day-of-week filter');
        return { recommendations: [], debug };
      }
    }

    // Step 8: Apply minimum spacing constraint if provided
    if (minSpacing && minSpacing > 0) {
      const spacedDates: string[] = [];
      let lastDate: Date | null = null;
      
      for (const dateStr of availableDates) {
        const currentDate = new Date(dateStr + 'T00:00:00');
        
        if (!lastDate) {
          // First date - always include
          spacedDates.push(dateStr);
          lastDate = currentDate;
        } else {
          // Check if date is at least minSpacing days after last date
          const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
          if (daysDiff >= minSpacing) {
            spacedDates.push(dateStr);
            lastDate = currentDate;
          }
        }
      }
      
      const beforeSpacing = availableDates.length;
      availableDates = spacedDates;
      const filteredBySpacing = beforeSpacing - spacedDates.length;
      
      if (filteredBySpacing > 0) {
        debug.notes.push(`Applied minimum ${minSpacing} day spacing (filtered ${filteredBySpacing} dates)`);
      }
      
      if (availableDates.length === 0) {
        debug.notes.push('No dates available after applying spacing constraint');
        return { recommendations: [], debug };
      }
    } else {
      // Step 9: Sort chronologically (no weekday prioritization)
      availableDates.sort();
    }

    // Apply max results limit
    const recommendations = availableDates.slice(0, maxResults);

    // Count weekdays vs weekends for debug
    const weekdayCount = recommendations.filter(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;
    const weekendCount = recommendations.length - weekdayCount;

    debug.notes.push(`Found ${recommendations.length} available dates (${weekdayCount} weekdays, ${weekendCount} weekends)`);

    return { recommendations, debug };
  }

  /**
   * Parse prompt into normalized tokens with abbreviation expansion
   */
  private parsePrompt(prompt: string): string[] {
    // Common filler words to ignore
    const STOP_WORDS = new Set([
      'find', 'me', 'available', 'dates', 'for', 'the', 'a', 'an', 'and', 'or',
      'show', 'get', 'give', 'list', 'search', 'when', 'what', 'is', 'are',
      'can', 'i', 'have', 'need', 'want', 'looking', 'schedule', 'schedules',
      'game', 'games', 'match', 'matches', 'my', 'our', 'team', 'teams',
      // Words describing TYPE of dates (not team characteristics)
      'open', 'free', 'empty', 'clear', 'good', 'best', 'suitable'
    ]);
    
    // Words related to constraints (not team identifiers) - should be filtered out
    const CONSTRAINT_WORDS = new Set([
      // Months
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
      'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
      // Days of week
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
      'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
      // Spacing/timing words
      'days', 'day', 'weeks', 'week', 'apart', 'between', 'least', 'minimum', 'min', 'max', 'maximum',
      // Date-related words
      'date', 'dates', 'time', 'times', 'on', 'in', 'at', 'from', 'to', 'until', 'before', 'after',
      // Exclusion words
      'not', 'no', 'never', 'avoid', 'exclude', 'excluding', 'without', 'except',
      'same', 'different', 'other', 'another', 'as', 'than', 'with',
      // Numbers (1-31 for dates)
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
      '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31',
    ]);
    
    const tokens: string[] = [];
    
    // Split on whitespace and punctuation, lowercase
    const rawTokens = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    for (const token of rawTokens) {
      // Skip stop words
      if (STOP_WORDS.has(token)) {
        continue;
      }
      
      // Skip constraint-related words
      if (CONSTRAINT_WORDS.has(token)) {
        continue;
      }
      
      const expansion = ABBREVIATION_MAP[token];
      if (expansion) {
        tokens.push(...expansion);
      } else {
        tokens.push(token);
      }
    }

    return tokens;
  }

  /**
   * Match parsed tokens against canonical sports data
   * CRITICAL: ALL tokens must match - no partial matching allowed
   */
  private matchClusters(parsedTokens: string[], threshold: number): CanonicalTeam[] {
    const canonicalTeams: CanonicalTeam[] = [];

    // Build canonical entries from JSON
    for (const sportData of canonicalSportsData.sports) {
      const sportName = sportData.name.toLowerCase();
      for (const team of sportData.teams) {
        const gender = team.gender.toLowerCase();
        const level = team.level.toLowerCase();
        
        const matchResult = this.scoreMatch(parsedTokens, sportName, gender, level);
        
        canonicalTeams.push({
          sport: sportData.name,
          gender: team.gender,
          level: team.level,
          score: matchResult.score,
        });
      }
    }

    // Filter by threshold AND require all tokens to be matched
    // NO FALLBACK - must be exact match for all tokens
    const matches = canonicalTeams.filter(t => {
      const matchResult = this.scoreMatch(parsedTokens, t.sport.toLowerCase(), t.gender.toLowerCase(), t.level.toLowerCase());
      return matchResult.score >= threshold && matchResult.allTokensMatched;
    });

    return matches;
  }

  /**
   * Score a canonical entry against parsed tokens
   * Returns score and whether ALL tokens were matched
   */
  private scoreMatch(tokens: string[], sport: string, gender: string, level: string): { score: number; allTokensMatched: boolean } {
    let score = 0;
    const sportTokens = sport.toLowerCase().split(/\s+/);
    const genderTokens = gender.toLowerCase().split(/\s+/);
    const levelTokens = level.toLowerCase().split(/\s+/);

    let hasSport = false;
    let hasGender = false;
    let hasLevel = false;
    
    // Track which input tokens have been matched
    const matchedTokens = new Set<string>();

    for (const token of tokens) {
      let tokenMatched = false;
      
      // Exact match with sport
      if (sportTokens.some(s => s === token)) {
        score += 2;
        hasSport = true;
        tokenMatched = true;
      } else if (sportTokens.some(s => s.includes(token) || token.includes(s))) {
        score += 1;
        hasSport = true;
        tokenMatched = true;
      }

      // Exact match with gender
      if (genderTokens.some(g => g === token)) {
        score += 2;
        hasGender = true;
        tokenMatched = true;
      } else if (genderTokens.some(g => g.includes(token) || token.includes(g))) {
        score += 1;
        hasGender = true;
        tokenMatched = true;
      } else if (token.length === 1 && genderTokens.some(g => g.startsWith(token))) {
        // Single-letter initial match (e.g., 'b' → 'boys')
        score += 0.5;
        hasGender = true;
        tokenMatched = true;
      }

      // Exact match with level
      if (levelTokens.some(l => l === token)) {
        score += 2;
        hasLevel = true;
        tokenMatched = true;
      } else if (levelTokens.some(l => l.includes(token) || token.includes(l))) {
        score += 1;
        hasLevel = true;
        tokenMatched = true;
      }
      
      if (tokenMatched) {
        matchedTokens.add(token);
      }
    }

    // Bonus: complete match (sport + gender + level)
    if (hasSport && hasGender && hasLevel) {
      score += 2;
    }

    // ALL tokens must be matched for valid result
    const allTokensMatched = matchedTokens.size === tokens.length;

    return { score, allTokensMatched };
  }

  /**
   * Extract dates from games table that belong to matched clusters
   * Only dates with EXACT team matches are considered conflicts
   */
  private extractClusterDates(
    gamesTable: GameRow[],
    clusters: CanonicalTeam[],
    debug: { notes: string[] }
  ): Set<string> {
    const clusterDates = new Set<string>();
    let rowsWithoutDates = 0;

    // Build exact team patterns to match (e.g., "Girls Varsity Basketball")
    const teamPatterns = clusters.map(cluster => {
      const patterns = [
        `${cluster.gender} ${cluster.level} ${cluster.sport}`.toLowerCase(),
        `${cluster.gender}${cluster.level}${cluster.sport}`.toLowerCase().replace(/\s+/g, ''),
        `${cluster.gender.charAt(0)}${cluster.level.charAt(0)} ${cluster.sport}`.toLowerCase(), // "GV Basketball"
        `${cluster.gender.charAt(0)} ${cluster.level.charAt(0)} ${cluster.sport}`.toLowerCase(), // "G V Basketball"
      ];
      return patterns;
    });

    for (const row of gamesTable) {
      // Build searchable string from row - include all possible data fields
      const searchableText = [
        row.sport,
        row.level,
        row.gender,
        row.team,
        row.description,
        row.title,
        JSON.stringify(row),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      // Check if row matches ANY of the exact team patterns
      let qualifies = false;
      for (const patterns of teamPatterns) {
        if (patterns.some(pattern => searchableText.includes(pattern))) {
          qualifies = true;
          break;
        }
      }

      if (!qualifies) continue;

      // Extract date if present
      const dateValue = row.date;
      if (!dateValue) {
        rowsWithoutDates++;
        continue;
      }

      // Parse date to ISO YYYY-MM-DD
      try {
        let dateStr: string;
        if (dateValue instanceof Date) {
          const year = dateValue.getUTCFullYear();
          const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
          const day = String(dateValue.getUTCDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else if (typeof dateValue === 'string') {
          // Extract YYYY-MM-DD from string
          const datePart = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
          if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            dateStr = datePart;
          } else {
            continue; // Invalid format
          }
        } else {
          continue;
        }

        clusterDates.add(dateStr);
      } catch (error) {
        // Ignore unparseable dates
        continue;
      }
    }

    if (rowsWithoutDates > 0) {
      debug.notes.push(`${rowsWithoutDates} matching rows had no parseable date`);
    }

    return clusterDates;
  }
}

export const availableDatesService = new AvailableDatesService();
