import { prisma } from "../database/prisma";

interface DepartureRecommendation {
  recommendedDepartureTime: string; // HH:MM format
  trafficCondition: string;
  weatherNote: string;
  bufferMinutes: number;
  travelTimeMinutes: number;
}

export class DismissDepartService {
  /**
   * Lightweight calculation of departure time from dismissal time
   * Cost-efficient: 1 Google Maps API call + 1 OpenWeather call
   */
  async calculateDepartureTime(
    gameId: string,
    organizationId: string,
    dismissalTime: string // HH:MM format
  ): Promise<DepartureRecommendation> {
    // Fetch game with venue and organization details
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: {
            organization: true,
          },
        },
        venue: true,
      },
    });

    if (!game || !game.venue) {
      throw new Error("Game or venue not found");
    }

    // Parse dismissal time and game date
    const gameDate = new Date(game.date);
    const [dismissHours, dismissMinutes] = dismissalTime.split(":").map(Number);
    
    const dismissalDateTime = new Date(gameDate);
    dismissalDateTime.setHours(dismissHours, dismissMinutes, 0, 0);

    // Get origin and destination
    const origin = `${game.homeTeam.organization.name}, ${game.homeTeam.organization.state}`;
    const destination = `${game.venue.address || game.venue.name}, ${game.venue.city}, ${game.venue.state}`;

    // Calculate traffic with Google Maps Distance Matrix API
    const trafficData = await this.getTrafficData(origin, destination, dismissalDateTime);

    // Get weather forecast if coordinates available
    let weatherData: { condition: string; precipitation: number; windSpeed: number; visibility: number } | null = null;
    if (game.venue.latitude && game.venue.longitude) {
      weatherData = await this.getWeatherData(game.venue.latitude, game.venue.longitude, dismissalDateTime);
    }

    // Calculate buffer time based on traffic and weather
    const bufferMinutes = this.calculateBufferTime(trafficData.trafficCondition, weatherData);

    // Calculate recommended departure time
    const totalMinutesNeeded = trafficData.travelTimeMinutes + bufferMinutes;
    const departureDateTime = new Date(dismissalDateTime);
    departureDateTime.setMinutes(departureDateTime.getMinutes() - totalMinutesNeeded);

    // Format departure time as HH:MM
    const departureHours = departureDateTime.getHours().toString().padStart(2, "0");
    const departureMinutes = departureDateTime.getMinutes().toString().padStart(2, "0");
    const recommendedDepartureTime = `${departureHours}:${departureMinutes}`;

    // Generate weather note
    const weatherNote = this.generateWeatherNote(weatherData);

    return {
      recommendedDepartureTime,
      trafficCondition: trafficData.trafficCondition,
      weatherNote,
      bufferMinutes,
      travelTimeMinutes: trafficData.travelTimeMinutes,
    };
  }

  private async getTrafficData(
    origin: string,
    destination: string,
    departureTime: Date
  ): Promise<{ travelTimeMinutes: number; trafficCondition: string }> {
    if (!process.env.GOOGLE_DISTANCE_API_KEY) {
      console.warn("Google Distance API key not configured, using default values");
      return {
        travelTimeMinutes: 45,
        trafficCondition: "unknown",
      };
    }

    const departureTimestamp = Math.floor(departureTime.getTime() / 1000);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(
      destination
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
          travelTimeMinutes: trafficTime,
          trafficCondition,
        };
      }
    } catch (error) {
      console.error("Failed to fetch traffic data:", error);
    }

    return {
      travelTimeMinutes: 45,
      trafficCondition: "unknown",
    };
  }

  private async getWeatherData(
    latitude: number,
    longitude: number,
    dateTime: Date
  ): Promise<{ condition: string; precipitation: number; windSpeed: number; visibility: number } | null> {
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

        return {
          condition: closestForecast.weather[0].main,
          precipitation: closestForecast.pop * 100,
          windSpeed: Math.round(closestForecast.wind.speed),
          visibility: closestForecast.visibility / 1609, // Convert meters to miles
        };
      }
    } catch (error) {
      console.error("Failed to fetch weather data:", error);
    }

    return null;
  }

  private calculateBufferTime(
    trafficCondition: string,
    weatherData: { condition: string; precipitation: number; windSpeed: number; visibility: number } | null
  ): number {
    let bufferMinutes = 15; // Base buffer

    // Add buffer based on traffic
    if (trafficCondition === "heavy") {
      bufferMinutes += 20;
    } else if (trafficCondition === "moderate") {
      bufferMinutes += 10;
    }

    // Add buffer based on weather
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

  private generateWeatherNote(weatherData: { condition: string; precipitation: number; windSpeed: number; visibility: number } | null): string {
    if (!weatherData) {
      return "Weather data unavailable";
    }

    const notes: string[] = [];

    if (weatherData.precipitation > 70) {
      notes.push("Heavy precipitation expected");
    } else if (weatherData.precipitation > 50) {
      notes.push("Moderate precipitation likely");
    }

    if (weatherData.condition.toLowerCase().includes("snow")) {
      notes.push("Snow conditions");
    }

    if (weatherData.condition.toLowerCase().includes("storm")) {
      notes.push("Severe weather possible");
    }

    if (weatherData.visibility < 2) {
      notes.push("Low visibility");
    }

    if (weatherData.windSpeed > 25) {
      notes.push("High winds");
    }

    if (notes.length === 0) {
      return `${weatherData.condition} - Normal conditions`;
    }

    return notes.join(", ");
  }
}

export const dismissDepartService = new DismissDepartService();
