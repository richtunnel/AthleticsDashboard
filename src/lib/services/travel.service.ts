import OpenAI from "openai";
import { prisma } from "../database/prisma";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Removed console.log that was causing build output

interface TravelRecommendation {
  estimatedTravelTime: number; // minutes
  recommendedDepartureTime: Date;
  busCount: number;
  estimatedCost: number;
  reasoning: string;
}

export class TravelService {
  async calculateTravelTime(originAddress: string, destinationAddress: string): Promise<{ travelTimeMinutes: number; distance: string }> {
    // Use Google Maps Distance Matrix API
    // For now, using a simple estimate - you should integrate the actual API

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originAddress)}&destinations=${encodeURIComponent(destinationAddress)}&key=${
      process.env.GOOGLE_MAPS_API_KEY
    }`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.rows[0]?.elements[0]?.status === "OK") {
        const element = data.rows[0].elements[0];
        return {
          travelTimeMinutes: Math.ceil(element.duration.value / 60),
          distance: element.distance.text,
        };
      }
    } catch (error) {
      console.error("Failed to calculate travel time:", error);
    }

    // Fallback: estimate based on typical speeds
    return {
      travelTimeMinutes: 45, // default
      distance: "Unknown",
    };
  }

  async getAIRecommendation(gameId: string, organizationId: string): Promise<TravelRecommendation> {
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        venue: true,
      },
    });

    if (!game || !game.venue) {
      throw new Error("Game or venue not found");
    }

    // Get team size estimate
    const teamSize = await this.estimateTeamSize(game.homeTeam.sport.name, game.homeTeam.level);

    // Get travel time if not already calculated
    let travelTime = game.estimatedTravelTime;
    if (!travelTime && game.venue) {
      // Get organization's home address
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (org) {
        const origin = `${org.name}, ${org.state}`;
        const destination = `${game.venue.address}, ${game.venue.city}, ${game.venue.state}`;

        const result = await this.calculateTravelTime(origin, destination);
        travelTime = result.travelTimeMinutes;
      }
    }

    if (!travelTime) {
      travelTime = 45; // default
    }

    // Use AI to generate recommendations
    const prompt = `You are an athletic director assistant. Provide travel recommendations for the following game:

Sport: ${game.homeTeam.sport.name}
Level: ${game.homeTeam.level}
Game Date: ${game.date.toLocaleDateString()}
Game Time: ${game.time || "TBD"}
Venue: ${game.venue.name}, ${game.venue.city}
Estimated Team Size: ${teamSize} people
Estimated Travel Time: ${travelTime} minutes

Provide recommendations in this exact JSON format:
{
  "estimatedTravelTime": <number in minutes>,
  "recommendedDepartureTime": "<ISO 8601 datetime>",
  "busCount": <number of buses needed>,
  "estimatedCost": <cost in dollars>,
  "reasoning": "<brief explanation of your recommendations>"
}

Consider:
- Teams should arrive 30-60 minutes before game time for warm-up
- Each bus holds approximately 40 people
- Budget $150 per bus per trip
- Add buffer time for traffic and unexpected delays`;

    try {
      if (!openai) {
        // Fallback to manual calculation if OpenAI not configured
        const arrivalTime = new Date(game.date);
        if (game.time) {
          const [hours, minutes] = game.time.split(":");
          arrivalTime.setHours(parseInt(hours), parseInt(minutes));
        }

        arrivalTime.setMinutes(arrivalTime.getMinutes() - 45);
        const departureTime = new Date(arrivalTime);
        departureTime.setMinutes(departureTime.getMinutes() - travelTime - 15);

        return {
          estimatedTravelTime: travelTime,
          recommendedDepartureTime: departureTime,
          busCount: Math.ceil(teamSize / 40),
          estimatedCost: Math.ceil(teamSize / 40) * 300,
          reasoning: "Calculated based on standard travel requirements (OpenAI not configured)",
        };
      }
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const recommendation = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        estimatedTravelTime: recommendation.estimatedTravelTime || travelTime,
        recommendedDepartureTime: new Date(recommendation.recommendedDepartureTime),
        busCount: recommendation.busCount || Math.ceil(teamSize / 40),
        estimatedCost: recommendation.estimatedCost || Math.ceil(teamSize / 40) * 300,
        reasoning: recommendation.reasoning || "Based on typical travel requirements",
      };
    } catch (error) {
      console.error("AI recommendation failed:", error);

      // Fallback to manual calculation
      const arrivalTime = new Date(game.date);
      if (game.time) {
        const [hours, minutes] = game.time.split(":");
        arrivalTime.setHours(parseInt(hours), parseInt(minutes));
      }

      // Arrive 45 minutes early
      arrivalTime.setMinutes(arrivalTime.getMinutes() - 45);

      // Subtract travel time
      const departureTime = new Date(arrivalTime);
      departureTime.setMinutes(departureTime.getMinutes() - travelTime - 15); // 15 min buffer

      return {
        estimatedTravelTime: travelTime,
        recommendedDepartureTime: departureTime,
        busCount: Math.ceil(teamSize / 40),
        estimatedCost: Math.ceil(teamSize / 40) * 300,
        reasoning: "Calculated based on standard travel requirements",
      };
    }
  }

  async detectScheduleConflicts(organizationId: string): Promise<
    Array<{
      game1: any;
      game2: any;
      conflict: string;
    }>
  > {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
        date: { gte: new Date() },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    const conflicts: Array<{ game1: any; game2: any; conflict: string }> = [];

    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const game1 = games[i];
        const game2 = games[j];

        // Same day conflicts
        if (game1.date.toDateString() === game2.date.toDateString() && game1.time && game2.time) {
          const time1 = new Date(`1970-01-01T${game1.time}`);
          const time2 = new Date(`1970-01-01T${game2.time}`);
          const diffMinutes = Math.abs(time2.getTime() - time1.getTime()) / 60000;

          // Games within 2 hours
          if (diffMinutes < 120) {
            conflicts.push({
              game1,
              game2,
              conflict: `Games scheduled ${Math.round(diffMinutes)} minutes apart`,
            });
          }
        }

        // Venue conflicts (same venue, same time)
        if (game1.venueId === game2.venueId && game1.date.toDateString() === game2.date.toDateString() && game1.time === game2.time) {
          conflicts.push({
            game1,
            game2,
            conflict: "Same venue and time",
          });
        }
      }
    }

    return conflicts;
  }

  private async estimateTeamSize(sport: string, level: string): Promise<number> {
    // Typical team sizes
    const sizes: Record<string, Record<string, number>> = {
      Football: { VARSITY: 60, JV: 50, FRESHMAN: 40 },
      Basketball: { VARSITY: 15, JV: 15, FRESHMAN: 15 },
      Baseball: { VARSITY: 20, JV: 20, FRESHMAN: 18 },
      Softball: { VARSITY: 18, JV: 18, FRESHMAN: 16 },
      Soccer: { VARSITY: 22, JV: 20, FRESHMAN: 18 },
      Volleyball: { VARSITY: 15, JV: 15, FRESHMAN: 15 },
    };

    return sizes[sport]?.[level] || 20; // default
  }
}

export const travelService = new TravelService();
