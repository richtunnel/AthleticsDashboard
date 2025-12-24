import { prisma } from "../database/prisma";

interface TrafficData {
  travelTimeMinutes: number;
  travelTimeInTraffic: number;
  distance: string;
  trafficCondition: string;
}

interface WeatherData {
  condition: string;
  temperature: number;
  description: string;
  precipitation: number;
  windSpeed: number;
  visibility: number;
}

interface EnhancedTravelInfo {
  travelTimeMinutes: number;
  travelTimeInTraffic: number;
  distance: string;
  trafficCondition: string;
  weatherCondition: string;
  weatherDetails: WeatherData;
  recommendedDepartureTime: Date;
  recommendedArrivalTime: Date;
  safetyRecommendations: string[];
  estimatedDelay: number;
}

export class TravelEnhancedService {
  async calculateTravelTimeWithTrafficAndWeather(
    originAddress: string,
    destinationAddress: string,
    departureTime: Date
  ): Promise<TrafficData> {
    const departureTimestamp = Math.floor(departureTime.getTime() / 1000);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originAddress)}&destinations=${encodeURIComponent(
      destinationAddress
    )}&departure_time=${departureTimestamp}&traffic_model=best_guess&key=${process.env.GOOGLE_DISTANCE_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.rows[0]?.elements[0]?.status === "OK") {
        const element = data.rows[0].elements[0];

        const normalTime = Math.ceil(element.duration.value / 60);
        const trafficTime = element.duration_in_traffic
          ? Math.ceil(element.duration_in_traffic.value / 60)
          : normalTime;

        let trafficCondition = "normal";
        const delayPercentage = ((trafficTime - normalTime) / normalTime) * 100;

        if (delayPercentage > 30) {
          trafficCondition = "heavy";
        } else if (delayPercentage > 15) {
          trafficCondition = "moderate";
        } else {
          trafficCondition = "light";
        }

        return {
          travelTimeMinutes: normalTime,
          travelTimeInTraffic: trafficTime,
          distance: element.distance.text,
          trafficCondition,
        };
      }
    } catch (error) {
      console.error("Failed to calculate travel time with traffic:", error);
    }

    return {
      travelTimeMinutes: 45,
      travelTimeInTraffic: 45,
      distance: "Unknown",
      trafficCondition: "unknown",
    };
  }

  async getWeatherForecast(
    latitude: number,
    longitude: number,
    dateTime: Date
  ): Promise<WeatherData | null> {
    if (!process.env.OPENWEATHER_API_KEY) {
      console.warn("OpenWeather API key not configured");
      return null;
    }

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.cod === "200" && data.list) {
        const targetTimestamp = dateTime.getTime() / 1000;

        let closestForecast = data.list[0];
        let minDiff = Math.abs(closestForecast.dt - targetTimestamp);

        for (const forecast of data.list) {
          const diff = Math.abs(forecast.dt - targetTimestamp);
          if (diff < minDiff) {
            minDiff = diff;
            closestForecast = forecast;
          }
        }

        const weather = closestForecast.weather[0];
        const main = closestForecast.main;
        const wind = closestForecast.wind;

        return {
          condition: weather.main,
          temperature: Math.round(main.temp),
          description: weather.description,
          precipitation: closestForecast.pop * 100,
          windSpeed: Math.round(wind.speed),
          visibility: closestForecast.visibility / 1609,
        };
      }
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
    }

    return null;
  }

  async getEnhancedTravelInfo(gameId: string, organizationId: string): Promise<EnhancedTravelInfo> {
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
            organization: true,
          },
        },
        venue: true,
      },
    });

    if (!game || !game.venue) {
      throw new Error("Game or venue not found");
    }

    const origin = `${game.homeTeam.organization.name}, ${game.homeTeam.organization.state}`;
    const destination = `${game.venue.address || game.venue.name}, ${game.venue.city}, ${game.venue.state}`;

    const gameDateTime = new Date(game.date);
    if (game.time) {
      const [hours, minutes] = game.time.split(":");
      gameDateTime.setHours(parseInt(hours), parseInt(minutes));
    }

    const estimatedDepartureTime = new Date(gameDateTime);
    estimatedDepartureTime.setMinutes(estimatedDepartureTime.getMinutes() - 120);

    const trafficData = await this.calculateTravelTimeWithTrafficAndWeather(
      origin,
      destination,
      estimatedDepartureTime
    );

    let weatherData: WeatherData | null = null;
    if (game.venue.latitude && game.venue.longitude) {
      weatherData = await this.getWeatherForecast(
        game.venue.latitude,
        game.venue.longitude,
        estimatedDepartureTime
      );
    }

    const bufferMinutes = this.calculateBufferTime(trafficData, weatherData);

    const recommendedDepartureTime = new Date(gameDateTime);
    recommendedDepartureTime.setMinutes(
      recommendedDepartureTime.getMinutes() - trafficData.travelTimeInTraffic - bufferMinutes - 45
    );

    const recommendedArrivalTime = new Date(gameDateTime);
    recommendedArrivalTime.setMinutes(recommendedArrivalTime.getMinutes() - 45);

    const safetyRecommendations = this.generateSafetyRecommendations(trafficData, weatherData);

    const weatherCondition = weatherData
      ? `${weatherData.condition} - ${weatherData.temperature}°F`
      : "No weather data available";

    return {
      travelTimeMinutes: trafficData.travelTimeMinutes,
      travelTimeInTraffic: trafficData.travelTimeInTraffic,
      distance: trafficData.distance,
      trafficCondition: trafficData.trafficCondition,
      weatherCondition,
      weatherDetails: weatherData || {
        condition: "Unknown",
        temperature: 0,
        description: "No data",
        precipitation: 0,
        windSpeed: 0,
        visibility: 10,
      },
      recommendedDepartureTime,
      recommendedArrivalTime,
      safetyRecommendations,
      estimatedDelay: trafficData.travelTimeInTraffic - trafficData.travelTimeMinutes,
    };
  }

  private calculateBufferTime(trafficData: TrafficData, weatherData: WeatherData | null): number {
    let bufferMinutes = 15;

    if (trafficData.trafficCondition === "heavy") {
      bufferMinutes += 20;
    } else if (trafficData.trafficCondition === "moderate") {
      bufferMinutes += 10;
    }

    if (weatherData) {
      if (weatherData.precipitation > 50) {
        bufferMinutes += 15;
      } else if (weatherData.precipitation > 30) {
        bufferMinutes += 10;
      }

      if (weatherData.condition.toLowerCase().includes("snow")) {
        bufferMinutes += 20;
      }

      if (weatherData.visibility < 2) {
        bufferMinutes += 15;
      }

      if (weatherData.windSpeed > 25) {
        bufferMinutes += 10;
      }
    }

    return bufferMinutes;
  }

  private generateSafetyRecommendations(
    trafficData: TrafficData,
    weatherData: WeatherData | null
  ): string[] {
    const recommendations: string[] = [];

    if (trafficData.trafficCondition === "heavy") {
      recommendations.push("Heavy traffic expected. Consider alternative routes or earlier departure.");
    } else if (trafficData.trafficCondition === "moderate") {
      recommendations.push("Moderate traffic expected. Allow extra travel time.");
    }

    if (weatherData) {
      if (weatherData.precipitation > 70) {
        recommendations.push("High chance of precipitation. Ensure buses are equipped for wet conditions.");
      }

      if (weatherData.condition.toLowerCase().includes("snow")) {
        recommendations.push(
          "Snow conditions expected. Verify buses have snow tires and drivers are experienced."
        );
      }

      if (weatherData.condition.toLowerCase().includes("storm") || weatherData.condition.toLowerCase().includes("thunder")) {
        recommendations.push("Severe weather possible. Monitor conditions and consider alternative plans.");
      }

      if (weatherData.visibility < 2) {
        recommendations.push("Low visibility expected. Ensure buses have proper lighting.");
      }

      if (weatherData.windSpeed > 25) {
        recommendations.push("High winds expected. Exercise caution, especially with high-profile vehicles.");
      }

      if (weatherData.temperature < 32) {
        recommendations.push("Freezing temperatures. Watch for ice on roads.");
      } else if (weatherData.temperature > 90) {
        recommendations.push("High temperatures. Ensure buses have working air conditioning.");
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Normal conditions expected. Standard safety precautions apply.");
    }

    return recommendations;
  }

  async updateGameWithEnhancedTravelInfo(gameId: string, organizationId: string): Promise<void> {
    const travelInfo = await this.getEnhancedTravelInfo(gameId, organizationId);

    await prisma.travelRecommendation.create({
      data: {
        gameId,
        recommendedDeparture: travelInfo.recommendedDepartureTime,
        recommendedArrival: travelInfo.recommendedArrivalTime,
        travelDuration: travelInfo.travelTimeInTraffic,
        trafficCondition: travelInfo.trafficCondition,
        weatherCondition: travelInfo.weatherCondition,
        addedToGame: false,
      },
    });
  }

  async applyTravelRecommendationToGame(
    gameId: string,
    recommendationId: string,
    organizationId: string
  ): Promise<void> {
    const recommendation = await prisma.travelRecommendation.findFirst({
      where: {
        id: recommendationId,
        gameId,
        game: {
          homeTeam: {
            organizationId,
          },
        },
      },
    });

    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    await prisma.$transaction([
      prisma.game.update({
        where: { id: gameId },
        data: {
          departureTime: recommendation.recommendedDeparture,
          estimatedTravelTime: recommendation.travelDuration,
          travelTimeMinutes: recommendation.travelDuration,
        },
      }),
      prisma.travelRecommendation.update({
        where: { id: recommendationId },
        data: {
          addedToGame: true,
          addedAt: new Date(),
        },
      }),
    ]);
  }
}

export const travelEnhancedService = new TravelEnhancedService();
