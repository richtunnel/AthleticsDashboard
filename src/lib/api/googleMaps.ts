interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: string;
      duration: {
        value: number;
        text: string;
      };
      duration_in_traffic?: {
        value: number;
        text: string;
      };
      distance: {
        value: number;
        text: string;
      };
    }>;
  }>;
  status: string;
}

export class GoogleMapsService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
  }

  async calculateTravelTime(
    origin: string,
    destination: string,
    departureTime?: Date
  ): Promise<{
    travelTimeMinutes: number;
    travelTimeWithTraffic?: number;
    distance: string;
    trafficCondition: string;
  }> {
    if (!this.apiKey) {
      throw new Error("Google Maps API key not configured");
    }

    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      key: this.apiKey,
      mode: "driving",
    });

    if (departureTime) {
      params.append("departure_time", Math.floor(departureTime.getTime() / 1000).toString());
      params.append("traffic_model", "best_guess");
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Google Maps API request failed: ${response.statusText}`);
      }

      const data: DistanceMatrixResponse = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Google Maps API error: ${data.status}`);
      }

      const element = data.rows[0]?.elements[0];

      if (!element || element.status !== "OK") {
        throw new Error(`Route not found: ${element?.status || "UNKNOWN"}`);
      }

      const baseTravelTime = Math.ceil(element.duration.value / 60);
      const travelTimeWithTraffic = element.duration_in_traffic ? Math.ceil(element.duration_in_traffic.value / 60) : baseTravelTime;

      let trafficCondition = "normal";
      if (element.duration_in_traffic) {
        const trafficRatio = travelTimeWithTraffic / baseTravelTime;
        if (trafficRatio > 1.5) {
          trafficCondition = "heavy";
        } else if (trafficRatio > 1.2) {
          trafficCondition = "moderate";
        } else {
          trafficCondition = "light";
        }
      }

      return {
        travelTimeMinutes: baseTravelTime,
        travelTimeWithTraffic,
        distance: element.distance.text,
        trafficCondition,
      };
    } catch (error) {
      console.error("Failed to calculate travel time:", error);
      throw error;
    }
  }

  async getAddressFromVenue(venue: { address?: string | null; city?: string | null; state?: string | null; name: string }): Promise<string> {
    if (venue.address && venue.city && venue.state) {
      return `${venue.address}, ${venue.city}, ${venue.state}`;
    }
    return `${venue.name}, ${venue.city || ""} ${venue.state || ""}`.trim();
  }
}

export const googleMapsService = new GoogleMapsService();
