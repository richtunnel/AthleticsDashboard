import OpenAI from "openai";
import { prisma } from "../database/prisma";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface ScheduleSuggestion {
  suggestedDate: string;
  suggestedTime: string;
  venue: string;
  venueId?: string;
  confidence: number;
  reasoning: string;
  conflicts: string[];
  alternatives: Array<{
    date: string;
    time: string;
    reason: string;
  }>;
}

export class SchedulerAIService {
  async suggestGameSlots(
    organizationId: string,
    params: {
      sportId: string;
      teamId: string;
      opponentId?: string;
      preferredDateRange?: {
        start: Date;
        end: Date;
      };
      preferredTimes?: string[];
      isHome?: boolean;
    }
  ): Promise<ScheduleSuggestion[]> {
    const { sportId, teamId, opponentId, preferredDateRange, preferredTimes, isHome = true } = params;

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        organizationId,
      },
      include: {
        sport: true,
        organization: true,
      },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    const startDate = preferredDateRange?.start || new Date();
    const endDate = preferredDateRange?.end || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const existingGames = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
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
        opponent: true,
        venue: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const venues = await prisma.venue.findMany({
      where: {
        organizationId,
      },
    });

    if (!openai) {
      return this.generateFallbackSuggestions(existingGames, venues, startDate, endDate, preferredTimes);
    }

    const prompt = `You are an athletic scheduler assistant. Analyze the following schedule and suggest optimal game dates and times.

Team Information:
- Sport: ${team.sport.name}
- Level: ${team.level}
- Organization: ${team.organization.name}

Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
Preferred Times: ${preferredTimes?.join(", ") || "Any"}
Game Type: ${isHome ? "Home" : "Away"}

Existing Games in Period:
${existingGames
  .map((g) => `- ${g.date.toLocaleDateString()} at ${g.time || "TBD"}: ${g.homeTeam.sport.name} ${g.homeTeam.level} vs ${g.opponent?.name || "TBD"}`)
  .join("\n")}

Available Venues:
${venues.map((v) => `- ${v.name} (${v.city}, ${v.state})`).join("\n")}

Requirements:
1. Avoid scheduling games on the same day for the same team
2. Leave at least 2 days between games for the same team
3. Consider typical game times: High school games usually 4:00 PM - 7:00 PM on weekdays, afternoons on weekends
4. Avoid scheduling during typical school hours (8 AM - 3 PM)
5. Consider venue availability (don't double-book venues)

Provide 3-5 optimal scheduling suggestions in this JSON format:
{
  "suggestions": [
    {
      "suggestedDate": "YYYY-MM-DD",
      "suggestedTime": "HH:MM",
      "venue": "Venue Name",
      "confidence": 0.95,
      "reasoning": "Brief explanation",
      "conflicts": ["List any minor concerns"],
      "alternatives": [
        {
          "date": "YYYY-MM-DD",
          "time": "HH:MM",
          "reason": "Why this is an alternative"
        }
      ]
    }
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      const suggestions = result.suggestions || [];

      return suggestions.map((s: any) => {
        const venue = venues.find((v) => v.name.toLowerCase().includes(s.venue.toLowerCase()));
        return {
          suggestedDate: s.suggestedDate,
          suggestedTime: s.suggestedTime,
          venue: s.venue,
          venueId: venue?.id,
          confidence: s.confidence,
          reasoning: s.reasoning,
          conflicts: s.conflicts || [],
          alternatives: s.alternatives || [],
        };
      });
    } catch (error) {
      console.error("AI scheduling failed:", error);
      return this.generateFallbackSuggestions(existingGames, venues, startDate, endDate, preferredTimes);
    }
  }

  async detectConflicts(
    organizationId: string,
    proposedDate: Date,
    proposedTime: string,
    teamId: string,
    venueId?: string
  ): Promise<{
    hasConflict: boolean;
    conflicts: Array<{
      type: string;
      description: string;
      severity: "high" | "medium" | "low";
    }>;
  }> {
    const conflicts: Array<{
      type: string;
      description: string;
      severity: "high" | "medium" | "low";
    }> = [];

    const sameDay = new Date(proposedDate);
    sameDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(sameDay);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingGames = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
        },
        date: {
          gte: sameDay,
          lt: nextDay,
        },
      },
      include: {
        homeTeam: true,
        venue: true,
      },
    });

    for (const game of existingGames) {
      if (game.homeTeamId === teamId) {
        conflicts.push({
          type: "same_team",
          description: `Team already has a game scheduled on ${game.date.toLocaleDateString()} at ${game.time || "TBD"}`,
          severity: "high",
        });
      }

      if (venueId && game.venueId === venueId && game.time === proposedTime) {
        conflicts.push({
          type: "venue_conflict",
          description: `Venue is already booked at ${proposedTime}`,
          severity: "high",
        });
      }

      if (game.time && proposedTime) {
        const gameTime = new Date(`1970-01-01T${game.time}`);
        const proposedTimeDate = new Date(`1970-01-01T${proposedTime}`);
        const diffMinutes = Math.abs(proposedTimeDate.getTime() - gameTime.getTime()) / 60000;

        if (diffMinutes < 120) {
          conflicts.push({
            type: "time_proximity",
            description: `Another game scheduled ${Math.round(diffMinutes)} minutes away`,
            severity: "medium",
          });
        }
      }
    }

    const recentGames = await prisma.game.findMany({
      where: {
        homeTeamId: teamId,
        date: {
          gte: new Date(proposedDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          lt: proposedDate,
        },
      },
      orderBy: {
        date: "desc",
      },
      take: 1,
    });

    if (recentGames.length > 0) {
      const lastGame = recentGames[0];
      const daysSinceLastGame = Math.floor((proposedDate.getTime() - lastGame.date.getTime()) / (24 * 60 * 60 * 1000));

      if (daysSinceLastGame < 2) {
        conflicts.push({
          type: "rest_period",
          description: `Only ${daysSinceLastGame} day(s) since last game - team may need more rest`,
          severity: "low",
        });
      }
    }

    return {
      hasConflict: conflicts.some((c) => c.severity === "high"),
      conflicts,
    };
  }

  private generateFallbackSuggestions(
    existingGames: any[],
    venues: any[],
    startDate: Date,
    endDate: Date,
    preferredTimes?: string[]
  ): ScheduleSuggestion[] {
    const suggestions: ScheduleSuggestion[] = [];
    const defaultTimes = preferredTimes || ["16:00", "17:00", "18:00"];

    const current = new Date(startDate);
    let suggestionsCount = 0;

    while (current <= endDate && suggestionsCount < 5) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = current.toISOString().split("T")[0];

        const hasGameOnDay = existingGames.some((g) => g.date.toISOString().split("T")[0] === dateStr);

        if (!hasGameOnDay) {
          const time = defaultTimes[suggestionsCount % defaultTimes.length];
          const venue = venues[suggestionsCount % venues.length];

          suggestions.push({
            suggestedDate: dateStr,
            suggestedTime: time,
            venue: venue?.name || "Home",
            venueId: venue?.id,
            confidence: 0.8,
            reasoning: "Available slot with no conflicts (fallback suggestion)",
            conflicts: [],
            alternatives: [],
          });

          suggestionsCount++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return suggestions;
  }
}

export const schedulerAIService = new SchedulerAIService();
