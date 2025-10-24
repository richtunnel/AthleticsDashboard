interface WeatherResponse {
  weather: Array<{ description: string; main: string }>;
  main: {
    temp: number;
    feels_like: number;
  };
  wind?: {
    speed?: number;
  };
}

export class OpenWeatherService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || process.env.OPEN_WEATHER_API_KEY || "";
  }

  async getWeatherByLocation(latitude: number, longitude: number, dateTime?: Date): Promise<{ description: string; main: string; temperatureCelsius: number | null }> {
    if (!this.apiKey) {
      throw new Error("OpenWeatherMap API key not configured");
    }

    // For forecasted weather, use One Call API (requires lat/lon). For simplicity, use current weather.
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      appid: this.apiKey,
      units: "metric",
    });

    const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`OpenWeatherMap request failed: ${response.statusText}`);
      }

      const data: WeatherResponse = await response.json();

      const weather = data.weather?.[0];
      const temperatureCelsius = data.main?.temp ?? null;

      return {
        description: weather?.description || "Unknown",
        main: weather?.main || "Unknown",
        temperatureCelsius,
      };
    } catch (error) {
      console.error("Failed to fetch weather:", error);
      throw error;
    }
  }
}

export const openWeatherService = new OpenWeatherService();
