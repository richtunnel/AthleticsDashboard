import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

const BUFFER_MINUTES = 22; // Fixed 22-minute cushion

interface TravelCalculation {
  recommendedDepartureTime: string;
  travelTimeMinutes: number;
  bufferMinutes: number;
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { gameId, dismissalTime, opponentAddress } = await request.json();

    // Validate inputs
    if (!gameId || !dismissalTime || !opponentAddress) {
      return new Response(
        JSON.stringify({ error: "Game ID, dismissal time, and opponent address are required" }),
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(dismissalTime)) {
      return new Response(
        JSON.stringify({ error: "Invalid time format. Expected HH:MM" }),
        { status: 400 }
      );
    }

    // Fetch game with organization details
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId: session.user.organizationId },
      },
      include: {
        homeTeam: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!game) {
      return new Response(JSON.stringify({ error: "Game not found" }), { status: 404 });
    }

    // Get origin address from user's school
    const organization = game.homeTeam.organization;
    const origin = (organization as any).schoolAddress || 
                   `${organization.name}, ${organization.state}`;

    // Calculate travel time using Google Maps
    const travelTimeMinutes = await calculateTravelTime(origin, opponentAddress);

    // Calculate recommended departure time
    const [hours, minutes] = dismissalTime.split(":").map(Number);
    const dismissalDateTime = new Date();
    dismissalDateTime.setHours(hours, minutes, 0, 0);

    const totalMinutesNeeded = travelTimeMinutes + BUFFER_MINUTES;
    const departureDateTime = new Date(dismissalDateTime);
    departureDateTime.setMinutes(departureDateTime.getMinutes() - totalMinutesNeeded);

    const departureHours = departureDateTime.getHours().toString().padStart(2, "0");
    const departureMinutes = departureDateTime.getMinutes().toString().padStart(2, "0");
    const recommendedDepartureTime = `${departureHours}:${departureMinutes}`;

    const calculation: TravelCalculation = {
      recommendedDepartureTime,
      travelTimeMinutes,
      bufferMinutes: BUFFER_MINUTES,
    };

    return new Response(
      JSON.stringify({ success: true, data: calculation }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Calculate travel time error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to calculate travel time" }),
      { status: 500 }
    );
  }
}

async function calculateTravelTime(origin: string, destination: string): Promise<number> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("Google Maps API key not configured, using default travel time");
    return 45; // Default fallback
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
    origin
  )}&destinations=${encodeURIComponent(destination)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Google Maps API HTTP error: ${response.status} ${response.statusText}`);
      console.warn("Using default travel time estimate");
      return 45; // Graceful fallback for HTTP errors
    }

    const data = await response.json();
    
    // Log the full response for debugging
    console.log("Google Maps API response:", JSON.stringify(data, null, 2));

    // Check overall API status
    if (data.status !== "OK") {
      console.warn(`Google Maps API status: ${data.status}`);
      if (data.error_message) {
        console.warn(`Error message: ${data.error_message}`);
      }
      console.warn("Using default travel time estimate");
      return 45; // Graceful fallback for API-level errors
    }

    // Check element-level status
    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status === "OK") {
      const durationInSeconds = element.duration.value;
      return Math.ceil(durationInSeconds / 60); // Convert to minutes
    }

    // Handle specific element statuses
    const elementStatus = element?.status || "UNKNOWN";
    console.warn(`Route calculation status: ${elementStatus}`);
    console.warn(`Origin: ${origin}`);
    console.warn(`Destination: ${destination}`);
    
    switch (elementStatus) {
      case "ZERO_RESULTS":
        console.warn("No route found between addresses. Using default travel time.");
        break;
      case "NOT_FOUND":
        console.warn("One or both addresses could not be geocoded. Using default travel time.");
        break;
      default:
        console.warn("Unable to calculate route. Using default travel time.");
    }

    // Graceful fallback - don't throw error
    return 45;
  } catch (error) {
    console.error("Failed to fetch travel time from Google Maps:", error);
    console.warn("Using default travel time estimate due to error");
    // Graceful fallback instead of throwing
    return 45;
  }
}
