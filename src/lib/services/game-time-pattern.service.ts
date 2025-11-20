/**
 * Game Time Pattern Detection Service
 * 
 * This service analyzes existing games to detect patterns in game times and provides:
 * 1. Auto-population of game times based on detected patterns
 * 2. Conflict detection for games with same sport, level, and date
 * 3. Suggested alternative times to avoid conflicts
 */

interface Game {
  id: string;
  date: string;
  time: string | null;
  homeTeam: {
    sport: {
      name: string;
    };
    level: string;
  };
  opponent?: {
    name: string;
  } | null;
}

interface TimePattern {
  type: 'single' | 'alternating' | 'day_of_week' | 'progression' | 'mixed';
  confidence: number; // 0-1 score
  predictedTime: string | null;
  pattern: string; // Human-readable description
  times: string[]; // All times in the pattern
}

interface ConflictInfo {
  hasConflict: boolean;
  conflicts: Array<{
    gameId: string;
    date: string;
    time: string;
    sport: string;
    level: string;
    opponent: string;
  }>;
  suggestedTimes: string[];
}

interface PatternAnalysis {
  sameTime: { time: string; count: number; percentage: number } | null;
  alternating: { times: string[]; count: number; percentage: number } | null;
  dayOfWeek: Map<number, { times: string[]; count: number }>;
  allTimes: Map<string, number>;
}

export class GameTimePatternService {
  /**
   * Detects time patterns from existing games and predicts the next game time
   */
  static detectTimePattern(games: Game[], currentDate?: string): TimePattern {
    if (!games || games.length === 0) {
      return {
        type: 'mixed',
        confidence: 0,
        predictedTime: null,
        pattern: 'No games available to detect pattern',
        times: [],
      };
    }

    // Filter games with times
    const gamesWithTime = games.filter(g => g.time !== null && g.time !== '');
    
    if (gamesWithTime.length === 0) {
      return {
        type: 'mixed',
        confidence: 0,
        predictedTime: null,
        pattern: 'No games with times found',
        times: [],
      };
    }

    // Analyze patterns
    const analysis = this.analyzeTimePatterns(gamesWithTime, currentDate);
    
    // Determine best pattern and predict time
    return this.selectBestPattern(analysis, gamesWithTime);
  }

  /**
   * Analyzes games to identify different pattern types
   */
  private static analyzeTimePatterns(games: Game[], currentDate?: string): PatternAnalysis {
    const allTimes = new Map<string, number>();
    const dayOfWeek = new Map<number, { times: string[]; count: number }>();
    
    // Count time occurrences
    games.forEach(game => {
      if (!game.time) return;
      
      allTimes.set(game.time, (allTimes.get(game.time) || 0) + 1);
      
      // Track by day of week
      const gameDate = new Date(game.date);
      const dayNum = gameDate.getDay();
      
      if (!dayOfWeek.has(dayNum)) {
        dayOfWeek.set(dayNum, { times: [], count: 0 });
      }
      
      const dayData = dayOfWeek.get(dayNum)!;
      if (!dayData.times.includes(game.time)) {
        dayData.times.push(game.time);
      }
      dayData.count++;
    });

    // Check for single dominant time (80%+ threshold)
    let sameTime: { time: string; count: number; percentage: number } | null = null;
    const totalGames = games.length;
    
    for (const [time, count] of allTimes.entries()) {
      const percentage = count / totalGames;
      if (percentage >= 0.8) {
        sameTime = { time, count, percentage };
        break;
      }
    }

    // Check for alternating pattern (2-3 times alternating)
    let alternating: { times: string[]; count: number; percentage: number } | null = null;
    
    if (allTimes.size >= 2 && allTimes.size <= 3 && !sameTime) {
      const sortedTimes = Array.from(allTimes.keys()).sort();
      const pattern = this.checkAlternatingPattern(games.map(g => g.time!), sortedTimes);
      
      if (pattern.isAlternating) {
        const count = games.filter(g => sortedTimes.includes(g.time!)).length;
        alternating = {
          times: sortedTimes,
          count,
          percentage: count / totalGames,
        };
      }
    }

    return {
      sameTime,
      alternating,
      dayOfWeek,
      allTimes,
    };
  }

  /**
   * Checks if times follow an alternating pattern
   */
  private static checkAlternatingPattern(times: string[], expectedTimes: string[]): { isAlternating: boolean; nextTime: string | null } {
    if (times.length < 3) return { isAlternating: false, nextTime: null };
    
    let alternations = 0;
    for (let i = 1; i < times.length; i++) {
      if (times[i] !== times[i - 1]) {
        alternations++;
      }
    }
    
    // If at least 60% of transitions are alternations
    const isAlternating = alternations / (times.length - 1) >= 0.6;
    
    // Predict next time based on last time
    let nextTime: string | null = null;
    if (isAlternating && times.length > 0) {
      const lastTime = times[times.length - 1];
      const lastIndex = expectedTimes.indexOf(lastTime);
      if (lastIndex !== -1) {
        nextTime = expectedTimes[(lastIndex + 1) % expectedTimes.length];
      }
    }
    
    return { isAlternating, nextTime };
  }

  /**
   * Selects the best pattern and returns prediction
   */
  private static selectBestPattern(analysis: PatternAnalysis, games: Game[]): TimePattern {
    // Priority 1: Single dominant time (80%+ of games)
    if (analysis.sameTime) {
      return {
        type: 'single',
        confidence: analysis.sameTime.percentage,
        predictedTime: analysis.sameTime.time,
        pattern: `Most games (${Math.round(analysis.sameTime.percentage * 100)}%) start at ${this.formatTimeDisplay(analysis.sameTime.time)}`,
        times: [analysis.sameTime.time],
      };
    }

    // Priority 2: Alternating pattern (60%+ consistency)
    if (analysis.alternating && analysis.alternating.percentage >= 0.6) {
      const pattern = this.checkAlternatingPattern(
        games.map(g => g.time!),
        analysis.alternating.times
      );
      
      return {
        type: 'alternating',
        confidence: analysis.alternating.percentage,
        predictedTime: pattern.nextTime,
        pattern: `Games alternate between ${analysis.alternating.times.map(t => this.formatTimeDisplay(t)).join(' and ')}`,
        times: analysis.alternating.times,
      };
    }

    // Priority 3: Most common time (even if < 80%)
    if (analysis.allTimes.size > 0) {
      const sortedTimes = Array.from(analysis.allTimes.entries())
        .sort((a, b) => b[1] - a[1]);
      
      const [mostCommonTime, count] = sortedTimes[0];
      const confidence = count / games.length;
      
      return {
        type: 'mixed',
        confidence,
        predictedTime: mostCommonTime,
        pattern: `Most common time is ${this.formatTimeDisplay(mostCommonTime)} (${Math.round(confidence * 100)}% of games)`,
        times: sortedTimes.map(([time]) => time),
      };
    }

    // Fallback: No clear pattern
    return {
      type: 'mixed',
      confidence: 0,
      predictedTime: null,
      pattern: 'No clear pattern detected',
      times: [],
    };
  }

  /**
   * Detects conflicts for a given game
   */
  static detectConflicts(
    games: Game[],
    targetDate: string,
    targetTime: string | null,
    targetSport: string,
    targetLevel: string,
    excludeGameId?: string
  ): ConflictInfo {
    if (!targetTime || !targetDate) {
      return {
        hasConflict: false,
        conflicts: [],
        suggestedTimes: this.generateSuggestedTimes(games, targetDate, targetSport, targetLevel),
      };
    }

    // Find games on same date with same sport and level
    const potentialConflicts = games.filter(game => {
      if (excludeGameId && game.id === excludeGameId) return false;
      
      // Check if same date
      const gameDate = new Date(game.date).toISOString().split('T')[0];
      const targetDateNorm = new Date(targetDate).toISOString().split('T')[0];
      
      if (gameDate !== targetDateNorm) return false;
      
      // Check if same sport and level
      return (
        game.homeTeam.sport.name === targetSport &&
        game.homeTeam.level === targetLevel
      );
    });

    // Check for time conflicts
    const conflicts = potentialConflicts
      .filter(game => game.time === targetTime)
      .map(game => ({
        gameId: game.id,
        date: game.date,
        time: game.time!,
        sport: game.homeTeam.sport.name,
        level: game.homeTeam.level,
        opponent: game.opponent?.name || 'TBD',
      }));

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      suggestedTimes: this.generateSuggestedTimes(games, targetDate, targetSport, targetLevel),
    };
  }

  /**
   * Generates suggested alternative times based on common patterns
   */
  private static generateSuggestedTimes(
    games: Game[],
    targetDate: string,
    targetSport: string,
    targetLevel: string
  ): string[] {
    // Get games for same sport/level
    const relevantGames = games.filter(
      game =>
        game.homeTeam.sport.name === targetSport &&
        game.homeTeam.level === targetLevel &&
        game.time !== null
    );

    // Get all used times for this date
    const targetDateNorm = new Date(targetDate).toISOString().split('T')[0];
    const usedTimes = new Set(
      games
        .filter(game => {
          const gameDate = new Date(game.date).toISOString().split('T')[0];
          return (
            gameDate === targetDateNorm &&
            game.homeTeam.sport.name === targetSport &&
            game.homeTeam.level === targetLevel &&
            game.time !== null
          );
        })
        .map(game => game.time!)
    );

    // Get common times from relevant games
    const timeFrequency = new Map<string, number>();
    relevantGames.forEach(game => {
      if (game.time) {
        timeFrequency.set(game.time, (timeFrequency.get(game.time) || 0) + 1);
      }
    });

    // Sort by frequency and filter out used times
    const suggestions = Array.from(timeFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([time]) => time)
      .filter(time => !usedTimes.has(time))
      .slice(0, 5); // Top 5 suggestions

    // If no suggestions, provide common game times
    if (suggestions.length === 0) {
      const commonTimes = ['15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '19:00'];
      return commonTimes.filter(time => !usedTimes.has(time)).slice(0, 5);
    }

    return suggestions;
  }

  /**
   * Formats time for display (HH:MM to h:mm AM/PM)
   */
  private static formatTimeDisplay(time: string): string {
    if (!time) return 'TBD';
    
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  }
}
