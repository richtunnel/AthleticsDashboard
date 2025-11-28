import OpenAI from "openai";
import { prisma } from "../database/prisma";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Rate limiting constants
const MAX_REQUESTS_PER_DAY = 10;
const RATE_LIMIT_WINDOW_HOURS = 24;

export interface DateConstraints {
  weekdays?: string[]; // ["Mon", "Tue", "Sat", "Sun"]
  between?: string; // "2025-07-01..2025-07-31"
  excludeResources?: string[]; // Venue names to exclude
  homeOnly?: boolean;
  awayOnly?: boolean;
  minDaysBetween?: number; // Minimum days between games
  count: number; // Number of dates to find (default 3, max 15)
}

export interface DateTimeRecommendation {
  date: Date;
  suggestedTime: string | null; // HH:MM format
  confidence: number; // 0-1 score for time suggestion
}

export interface AvailableDatesResult {
  availableDates: Date[];
  recommendations?: DateTimeRecommendation[]; // Dates with time suggestions
  constraints: DateConstraints;
  reasoning?: string;
  error?: string;
}

export class AvailableDatesService {
  /**
   * Parse natural language prompt into structured constraints using LLM
   */
  async parsePromptWithLLM(
    prompt: string,
    sport: string,
    level: string,
    currentDate: Date = new Date()
  ): Promise<DateConstraints> {
    if (!openai) {
      // Fallback: basic parsing without LLM
      return this.fallbackParsing(prompt, currentDate);
    }

    const systemPrompt = `You are a sports scheduling assistant. Parse the user's natural language request into structured date constraints for finding available game dates.

Context:
- Sport: ${sport}
- Level: ${level}
- Current Date: ${currentDate.toISOString().split('T')[0]}

Output JSON schema:
{
  "weekdays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], // Optional: specific days of week
  "between": "YYYY-MM-DD..YYYY-MM-DD", // Optional: date range
  "excludeResources": ["Venue Name"], // Optional: venues to avoid
  "homeOnly": true/false, // Optional: only home games
  "awayOnly": true/false, // Optional: only away games
  "minDaysBetween": 3, // Optional: minimum days between games
  "count": 3 // Number of dates to find (default 3)
}

Rules:
1. If no date range specified, default to next 90 days from current date
2. Weekday abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun
3. Extract count from phrases like "3 dates", "five days", etc. (default to 3)
4. "weekends" = ["Sat", "Sun"], "weekdays" = ["Mon", "Tue", "Wed", "Thu", "Fri"]
5. "home" = homeOnly: true, "away" = awayOnly: true
6. Only include fields that are explicitly mentioned or can be inferred

Examples:
- "Find 3 dates in July on weekends when we're home" → {"weekdays": ["Sat","Sun"], "between": "2025-07-01..2025-07-31", "homeOnly": true, "count": 3}
- "5 weekday dates in March" → {"weekdays": ["Mon","Tue","Wed","Thu","Fri"], "between": "2025-03-01..2025-03-31", "count": 5}
- "Next 4 Saturdays" → {"weekdays": ["Sat"], "count": 4}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      
      // Validate and normalize the result - cap at 15 dates max
      const constraints: DateConstraints = {
        count: Math.min(result.count || 3, 15),
      };

      if (result.weekdays && Array.isArray(result.weekdays)) {
        constraints.weekdays = result.weekdays;
      }

      if (result.between && typeof result.between === 'string') {
        constraints.between = result.between;
      } else {
        // Default to next 90 days
        const endDate = new Date(currentDate);
        endDate.setDate(endDate.getDate() + 90);
        constraints.between = `${currentDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
      }

      if (result.excludeResources && Array.isArray(result.excludeResources)) {
        constraints.excludeResources = result.excludeResources;
      }

      if (result.homeOnly === true) {
        constraints.homeOnly = true;
      }

      if (result.awayOnly === true) {
        constraints.awayOnly = true;
      }

      if (result.minDaysBetween && typeof result.minDaysBetween === 'number') {
        constraints.minDaysBetween = result.minDaysBetween;
      }

      return constraints;
    } catch (error) {
      console.error("LLM parsing failed:", error);
      return this.fallbackParsing(prompt, currentDate);
    }
  }

  /**
   * Fallback parsing without LLM - basic keyword detection
   */
  private fallbackParsing(prompt: string, currentDate: Date): DateConstraints {
    const lowerPrompt = prompt.toLowerCase();
    const constraints: DateConstraints = {
      count: 3,
    };

    // Extract count - cap at 15 dates max
    const countMatch = prompt.match(/(\d+)\s*(date|day|game)/i);
    if (countMatch) {
      constraints.count = Math.min(parseInt(countMatch[1], 10), 15);
    }

    // Detect weekends
    if (lowerPrompt.includes('weekend')) {
      constraints.weekdays = ['Sat', 'Sun'];
    }

    // Detect weekdays
    if (lowerPrompt.includes('weekday')) {
      constraints.weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }

    // Detect home/away
    if (lowerPrompt.includes('home')) {
      constraints.homeOnly = true;
    }
    if (lowerPrompt.includes('away')) {
      constraints.awayOnly = true;
    }

    // Detect month names and set date range
    const monthNames = [
      { full: 'january', short: 'jan', index: 0 },
      { full: 'february', short: 'feb', index: 1 },
      { full: 'march', short: 'mar', index: 2 },
      { full: 'april', short: 'apr', index: 3 },
      { full: 'may', short: 'may', index: 4 },
      { full: 'june', short: 'jun', index: 5 },
      { full: 'july', short: 'jul', index: 6 },
      { full: 'august', short: 'aug', index: 7 },
      { full: 'september', short: 'sep', index: 8 },
      { full: 'october', short: 'oct', index: 9 },
      { full: 'november', short: 'nov', index: 10 },
      { full: 'december', short: 'dec', index: 11 },
    ];

    let monthDetected = false;
    for (const month of monthNames) {
      if (lowerPrompt.includes(month.full) || lowerPrompt.includes(month.short)) {
        monthDetected = true;
        // Determine the year - if month has passed this year, use next year
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        let targetYear = currentYear;
        
        // If the target month is before the current month, assume next year
        if (month.index < currentMonth) {
          targetYear = currentYear + 1;
        }

        // Create start and end dates for the month
        const startDate = new Date(targetYear, month.index, 1);
        const endDate = new Date(targetYear, month.index + 1, 0); // Last day of month
        
        constraints.between = `${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
        break;
      }
    }

    // If no month detected, use default date range: next 90 days
    if (!monthDetected) {
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + 90);
      constraints.between = `${currentDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;
    }

    return constraints;
  }

  /**
   * Detect time patterns from existing games
   */
  private detectTimePattern(games: any[]): { suggestedTime: string | null; confidence: number } {
    const gamesWithTime = games.filter(g => g.time && g.time.trim() !== '');
    
    if (gamesWithTime.length === 0) {
      return { suggestedTime: null, confidence: 0 };
    }

    // Count time occurrences
    const timeCounts = new Map<string, number>();
    gamesWithTime.forEach(game => {
      const count = timeCounts.get(game.time) || 0;
      timeCounts.set(game.time, count + 1);
    });

    // Find most common time
    let mostCommonTime = '';
    let maxCount = 0;
    timeCounts.forEach((count, time) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonTime = time;
      }
    });

    const confidence = maxCount / gamesWithTime.length;
    
    // Only suggest times between 8AM and 8PM
    const [hours] = mostCommonTime.split(':').map(Number);
    if (hours < 8 || hours >= 20) {
      // Time is outside preferred range, return default time
      return { suggestedTime: '15:00', confidence: 0.3 }; // 3 PM default
    }

    return { suggestedTime: mostCommonTime, confidence };
  }

  /**
   * Find available dates with time recommendations based on constraints
   */
  async findAvailableDatesWithTimes(
    userId: string,
    organizationId: string,
    sport: string,
    level: string,
    constraints: DateConstraints
  ): Promise<DateTimeRecommendation[]> {
    // Parse date range
    const [startDateStr, endDateStr] = (constraints.between || '').split('..');
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range');
    }

    // Get all existing games for pattern analysis
    const allGames = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
          sport: {
            name: sport,
          },
          level: level as any,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 50, // Analyze last 50 games for pattern
    });

    // Detect time pattern from existing games
    const timePattern = this.detectTimePattern(allGames);

    // Get games in the target date range to check for conflicts
    const existingGamesInRange = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
          sport: {
            name: sport,
          },
          level: level as any,
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
        venue: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Build a set of booked dates (date strings)
    const bookedDates = new Set<string>();
    existingGamesInRange.forEach((game) => {
      bookedDates.add(game.date.toISOString().split('T')[0]);
    });

    // Generate all dates in range that match constraints
    // Priority: weekdays first, then weekends
    const weekdayDates: Date[] = [];
    const weekendDates: Date[] = [];
    const current = new Date(startDate);
    const lastGameDate = existingGamesInRange.length > 0 
      ? new Date(existingGamesInRange[existingGamesInRange.length - 1].date) 
      : null;

    const maxDates = Math.min(constraints.count, 15); // Cap at 15

    // First pass: collect all available dates
    while (current <= endDate && (weekdayDates.length + weekendDates.length) < maxDates * 2) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Check if date is already booked
      if (bookedDates.has(dateStr)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Check day of week constraint if specified
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = dayNames[current.getDay()];
      const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dayName);
      
      if (constraints.weekdays && constraints.weekdays.length > 0) {
        if (!constraints.weekdays.includes(dayName)) {
          current.setDate(current.getDate() + 1);
          continue;
        }
      }

      // Check minimum days between games
      if (constraints.minDaysBetween && lastGameDate) {
        const daysSince = Math.floor((current.getTime() - lastGameDate.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince < constraints.minDaysBetween) {
          current.setDate(current.getDate() + 1);
          continue;
        }
      }

      // Categorize by weekday/weekend
      if (isWeekday) {
        weekdayDates.push(new Date(current));
      } else {
        weekendDates.push(new Date(current));
      }
      
      current.setDate(current.getDate() + 1);
    }

    // Prioritize weekdays, then fill with weekends if needed
    const selectedDates = [
      ...weekdayDates.slice(0, maxDates),
      ...weekendDates.slice(0, Math.max(0, maxDates - weekdayDates.length))
    ].slice(0, maxDates);

    // Create recommendations with time suggestions
    const recommendations: DateTimeRecommendation[] = selectedDates.map(date => ({
      date,
      suggestedTime: timePattern.suggestedTime,
      confidence: timePattern.confidence,
    }));

    return recommendations;
  }

  /**
   * Find available dates based on constraints (legacy method)
   */
  async findAvailableDates(
    userId: string,
    organizationId: string,
    sport: string,
    level: string,
    constraints: DateConstraints
  ): Promise<Date[]> {
    const recommendations = await this.findAvailableDatesWithTimes(
      userId,
      organizationId,
      sport,
      level,
      constraints
    );
    return recommendations.map(r => r.date);
  }

  /**
   * Check rate limit for user
   */
  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    // Count requests in the last 24 hours using FeedbackSubmission as a proxy
    // In production, you'd want a dedicated table for this
    const recentRequests = await prisma.feedbackSubmission.count({
      where: {
        userId,
        subject: 'AVAILABLE_DATES_REQUEST', // Use a special marker
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
          subject: 'AVAILABLE_DATES_REQUEST',
          message: prompt,
          name: 'System',
        },
      });
    } catch (error) {
      console.error('Failed to log request:', error);
      // Non-critical, don't throw
    }
  }

  /**
   * Main orchestration method
   */
  async findAvailableDatesFromPrompt(
    userId: string,
    organizationId: string,
    prompt: string,
    sport?: string,
    level?: string
  ): Promise<AvailableDatesResult> {
    try {
      // Check rate limit
      const rateLimit = await this.checkRateLimit(userId);
      if (!rateLimit.allowed) {
        return {
          availableDates: [],
          constraints: { count: 3 },
          error: `Rate limit exceeded. You can make ${rateLimit.remaining} more requests. Resets at ${rateLimit.resetAt.toLocaleString()}.`,
        };
      }

      // Log the request for rate limiting
      await this.logRequest(userId, prompt);

      // Get user's most recent game if sport/level not provided
      let targetSport = sport;
      let targetLevel = level;

      if (!targetSport || !targetLevel) {
        const recentGame = await prisma.game.findFirst({
          where: {
            homeTeam: {
              organizationId,
            },
          },
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (recentGame) {
          targetSport = targetSport || recentGame.homeTeam.sport.name;
          targetLevel = targetLevel || recentGame.homeTeam.level;
        } else {
          return {
            availableDates: [],
            constraints: { count: 3 },
            error: 'No sport or level specified and no recent games found.',
          };
        }
      }

      // Parse prompt with LLM
      const constraints = await this.parsePromptWithLLM(prompt, targetSport, targetLevel);

      // Find available dates with time recommendations
      const recommendations = await this.findAvailableDatesWithTimes(
        userId,
        organizationId,
        targetSport,
        targetLevel,
        constraints
      );

      // Generate reasoning
      const reasoning = this.generateReasoning(constraints, recommendations.length);

      return {
        availableDates: recommendations.map(r => r.date),
        recommendations,
        constraints,
        reasoning,
      };
    } catch (error) {
      console.error('Available dates service error:', error);
      return {
        availableDates: [],
        constraints: { count: 3 },
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * Generate human-readable reasoning for the results
   */
  private generateReasoning(constraints: DateConstraints, foundCount: number): string {
    const parts: string[] = [];

    if (constraints.weekdays && constraints.weekdays.length > 0) {
      parts.push(`on ${constraints.weekdays.join(', ')}`);
    }

    if (constraints.between) {
      const [start, end] = constraints.between.split('..');
      parts.push(`between ${start} and ${end}`);
    }

    if (constraints.homeOnly) {
      parts.push('for home games only');
    }

    if (constraints.awayOnly) {
      parts.push('for away games only');
    }

    if (constraints.minDaysBetween) {
      parts.push(`with at least ${constraints.minDaysBetween} days between games`);
    }

    const criteriaStr = parts.length > 0 ? ` ${parts.join(', ')}` : '';
    
    if (foundCount === 0) {
      return `No available dates found${criteriaStr}.`;
    }

    if (foundCount < constraints.count) {
      return `Found ${foundCount} of ${constraints.count} requested dates${criteriaStr}.`;
    }

    return `Found ${foundCount} available dates${criteriaStr}.`;
  }
}

export const availableDatesService = new AvailableDatesService();
