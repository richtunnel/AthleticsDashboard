import { prisma } from "../database/prisma";
import canonicalSportsData from "../data/canonical-sports.json";

// Rate limiting constants
const MAX_REQUESTS_PER_DAY = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

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
    notes: string[];
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
    options?: { maxResults?: number; threshold?: number }
  ): Promise<AvailableDatesResult> {
    const maxResults = Math.min(options?.maxResults || 6, 15);
    const threshold = options?.threshold || 2.5;
    const debug = {
      parsedTokens: [] as string[],
      matchedClusters: [] as ClusterMatch[],
      clusterDates: [] as string[],
      notes: [] as string[],
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

    // Step 3: Extract cluster dates from games table
    const clusterDates = this.extractClusterDates(gamesTable, matchedClusters, debug);
    debug.clusterDates = Array.from(clusterDates).sort();

    // Step 4: Filter candidateDates and prioritize weekdays
    const availableDates = validCandidates.filter(date => !clusterDates.has(date));
    
    if (availableDates.length === 0) {
      debug.notes.push('All candidate dates are blocked by existing games');
      return { recommendations: [], debug };
    }

    // Step 5: Sort chronologically, prioritize weekdays
    const weekdays: string[] = [];
    const weekends: string[] = [];

    availableDates.forEach(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends.push(dateStr);
      } else {
        weekdays.push(dateStr);
      }
    });

    // Sort each group chronologically
    weekdays.sort();
    weekends.sort();

    // Merge: weekdays first, then weekends
    const recommendations = [...weekdays, ...weekends].slice(0, maxResults);

    debug.notes.push(`Found ${recommendations.length} available dates (${weekdays.length} weekdays, ${weekends.length} weekends)`);

    return { recommendations, debug };
  }

  /**
   * Parse prompt into normalized tokens with abbreviation expansion
   */
  private parsePrompt(prompt: string): string[] {
    const tokens: string[] = [];
    
    // Split on whitespace and punctuation, lowercase
    const rawTokens = prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    for (const token of rawTokens) {
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
    let matches = canonicalTeams.filter(t => {
      const matchResult = this.scoreMatch(parsedTokens, t.sport.toLowerCase(), t.gender.toLowerCase(), t.level.toLowerCase());
      return matchResult.score >= threshold && matchResult.allTokensMatched;
    });

    // If no matches, try sport-only fallback
    if (matches.length === 0) {
      const sportTokens = parsedTokens.filter(t => 
        canonicalSportsData.sports.some(s => s.name.toLowerCase().includes(t))
      );
      
      if (sportTokens.length > 0) {
        // Return all gender/level combos for matched sport(s)
        matches = canonicalTeams.filter(t => 
          sportTokens.some(token => t.sport.toLowerCase().includes(token))
        );
      }
    }

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
   */
  private extractClusterDates(
    gamesTable: GameRow[],
    clusters: CanonicalTeam[],
    debug: { notes: string[] }
  ): Set<string> {
    const clusterDates = new Set<string>();
    let rowsWithoutDates = 0;

    for (const row of gamesTable) {
      // Build searchable string from row
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

      // Check if row qualifies for any cluster
      let qualifies = false;
      for (const cluster of clusters) {
        const sport = cluster.sport.toLowerCase();
        const gender = cluster.gender.toLowerCase();
        const level = cluster.level.toLowerCase();

        // Row qualifies if:
        // (contains sport AND (contains gender OR contains level))
        // OR (contains gender AND contains level)
        const hasSport = searchableText.includes(sport);
        const hasGender = searchableText.includes(gender);
        const hasLevel = searchableText.includes(level);

        if ((hasSport && (hasGender || hasLevel)) || (hasGender && hasLevel)) {
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

  /**
   * Check rate limit for user
   */
  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const recentRequests = await prisma.feedbackSubmission.count({
      where: {
        userId,
        subject: 'AVAILABLE_DATES_REQUEST',
        createdAt: {
          gte: windowStart,
        },
      },
    });

    const remaining = Math.max(0, MAX_REQUESTS_PER_DAY - recentRequests);
    const allowed = recentRequests < MAX_REQUESTS_PER_DAY;

    const resetAt = new Date();
    resetAt.setHours(resetAt.getHours() + RATE_LIMIT_WINDOW_HOURS);

    return { allowed, remaining, resetAt };
  }

  /**
   * Log a request (for rate limiting)
   */
  async logRequest(userId: string, prompt: string): Promise<void> {
    try {
      await prisma.feedbackSubmission.create({
        data: {
          userId,
          name: 'Available Dates Search',
          subject: 'AVAILABLE_DATES_REQUEST',
          message: prompt,
        },
      });
    } catch (error) {
      console.error('Failed to log available dates request:', error);
    }
  }
}

export const availableDatesService = new AvailableDatesService();
