import { prisma } from "../database/prisma";
import { googleMapsService } from "../api/googleMaps";
import { openWeatherService } from "../api/openWeather";

interface TravelRecommendationResult {
  recommendedDeparture: Date;
  recommendedArrival: Date;
  travelDuration: number;
  trafficCondition: string;
  weatherCondition: string;
}

export class TravelAIService {
  async calculateTravelTime(origin: string, destination: string, departureTime?: Date): Promise<{ travelTimeMinutes: number; distance: string; trafficCondition: string }> {
    try {
      const result = await googleMapsService.calculateTravelTime(origin, destination, departureTime);
      return {
        travelTimeMinutes: result.travelTimeWithTraffic || result.travelTimeMinutes,
        distance: result.distance,
        trafficCondition: result.trafficCondition,
      };
    } catch (error) {
      console.error("Failed to calculate travel time:", error);
      return {
        travelTimeMinutes: 60,
        distance: "Unknown",
        trafficCondition: "unknown",
      };
    }
  }

  async getWeatherConditions(latitude: number, longitude: number, dateTime?: Date): Promise<{ description: string; main: string }> {
    try {
      const weather = await openWeatherService.getWeatherByLocation(latitude, longitude, dateTime);
      return {
        description: weather.description,
        main: weather.main,
      };
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      return {
        description: "Unknown",
        main: "Unknown",
      };
    }
  }

  async generateBusRecommendation(gameId: string, organizationId: string): Promise<TravelRecommendationResult> {
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
            organization: {
              include: {
                travelSettings: true,
              },
            },
          },
        },
        venue: true,
      },
    });

    if (!game || !game.venue) {
      throw new Error("Game or venue not found");
    }

    const origin = await this.getOrganizationAddress(game.homeTeam.organization);
    const destination = await googleMapsService.getAddressFromVenue(game.venue);

    const gameDateTime = new Date(game.date);
    if (game.time) {
      const [hours, minutes] = game.time.split(":");
      gameDateTime.setHours(parseInt(hours), parseInt(minutes));
    }

    const travelSettings = game.homeTeam.organization.travelSettings;
    const arrivalBufferMinutes = travelSettings?.defaultBufferMinutes || 45;
    const busLoadingMinutes = travelSettings?.busLoadingMinutes || 15;

    const recommendedArrival = new Date(gameDateTime);
    recommendedArrival.setMinutes(recommendedArrival.getMinutes() - arrivalBufferMinutes);

    const estimatedDepartureTime = new Date(recommendedArrival);
    estimatedDepartureTime.setMinutes(estimatedDepartureTime.getMinutes() - 60);

    const travelInfo = await this.calculateTravelTime(origin, destination, estimatedDepartureTime);

    const recommendedDeparture = new Date(recommendedArrival);
    recommendedDeparture.setMinutes(recommendedDeparture.getMinutes() - travelInfo.travelTimeMinutes - busLoadingMinutes);

    let weatherCondition = "Unknown";
    if (game.venue.latitude && game.venue.longitude) {
      const weather = await this.getWeatherConditions(game.venue.latitude, game.venue.longitude, gameDateTime);
      weatherCondition = `${weather.main} - ${weather.description}`;
    }

    return {
      recommendedDeparture,
      recommendedArrival,
      travelDuration: travelInfo.travelTimeMinutes,
      trafficCondition: travelInfo.trafficCondition,
      weatherCondition,
    };
  }

  async recommendDepartureTime(arrivalTime: Date, origin: string, destination: string): Promise<{ departureTime: Date; travelDuration: number }> {
    const estimatedDepartureTime = new Date(arrivalTime);
    estimatedDepartureTime.setMinutes(estimatedDepartureTime.getMinutes() - 60);

    const travelInfo = await this.calculateTravelTime(origin, destination, estimatedDepartureTime);

    const busLoadingMinutes = 15;
    const departureTime = new Date(arrivalTime);
    departureTime.setMinutes(departureTime.getMinutes() - travelInfo.travelTimeMinutes - busLoadingMinutes);

    return {
      departureTime,
      travelDuration: travelInfo.travelTimeMinutes,
    };
  }

  async batchGenerateRecommendations(
    gameIds: string[],
    organizationId: string
  ): Promise<
    Array<{
      gameId: string;
      recommendation: any | null;
      error?: string;
    }>
  > {
    const results: Array<{ gameId: string; recommendation: any | null; error?: string }> = [];

    for (const gameId of gameIds) {
      try {
        const recommendation = await this.createTravelRecommendation(gameId, organizationId);
        results.push({ gameId, recommendation });
      } catch (error: any) {
        results.push({
          gameId,
          recommendation: null,
          error: error?.message || "Failed to generate recommendation",
        });
      }
    }

    return results;
  }

  private async getOrganizationAddress(organization: { name: string; state?: string | null; district?: string | null }): Promise<string> {
    const segments = [organization.name];
    if (organization.district) segments.push(organization.district);
    if (organization.state) segments.push(organization.state);
    return segments.filter(Boolean).join(", ");
  }

  async createTravelRecommendation(gameId: string, organizationId: string): Promise<any> {
    const recommendation = await this.generateBusRecommendation(gameId, organizationId);

    const travelRecommendation = await prisma.travelRecommendation.create({
      data: {
        gameId,
        recommendedDeparture: recommendation.recommendedDeparture,
        recommendedArrival: recommendation.recommendedArrival,
        travelDuration: recommendation.travelDuration,
        trafficCondition: recommendation.trafficCondition,
        weatherCondition: recommendation.weatherCondition,
      },
    });

    return travelRecommendation;
  }

  async addRecommendationToGame(gameId: string, recommendationId: string): Promise<void> {
    const recommendation = await prisma.travelRecommendation.findUnique({
      where: { id: recommendationId },
    });

    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        recommendedDepartureTime: recommendation.recommendedDeparture,
        recommendedArrivalTime: recommendation.recommendedArrival,
        travelTimeMinutes: recommendation.travelDuration,
        departureTime: recommendation.recommendedDeparture,
      },
    });

    await prisma.travelRecommendation.update({
      where: { id: recommendationId },
      data: {
        addedToGame: true,
        addedAt: new Date(),
      },
    });
  }

  async undoRecommendation(gameId: string): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: {
        recommendedDepartureTime: null,
        recommendedArrivalTime: null,
        travelTimeMinutes: null,
      },
    });

    await prisma.travelRecommendation.updateMany({
      where: {
        gameId,
        addedToGame: true,
      },
      data: {
        addedToGame: false,
        addedAt: null,
      },
    });
  }

  async cleanupExpiredRecommendations(): Promise<number> {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

    const result = await prisma.travelRecommendation.deleteMany({
      where: {
        addedToGame: true,
        addedAt: {
          lt: thirtyMinutesAgo,
        },
      },
    });

    return result.count;
  }
}

export const travelAIService = new TravelAIService();
