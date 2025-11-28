import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * Google Places Autocomplete API (Server-side)
 * 
 * Purpose: Provides autocomplete suggestions for addresses while keeping API key secure
 * 
 * Request body:
 * - input: string (required) - User's search text
 * - sessionToken: string (optional) - For billing optimization
 * 
 * Response:
 * - success: boolean
 * - predictions: Array of { placeId, description, structuredFormatting }
 */
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API key not configured");
      return NextResponse.json(
        { success: false, error: "Google Maps API not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { input, sessionToken } = body;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Input is required" },
        { status: 400 }
      );
    }

    // Build Google Places Autocomplete API URL
    const params = new URLSearchParams({
      input: input.trim(),
      key: GOOGLE_MAPS_API_KEY,
      types: "address", // Focus on addresses (can also include "establishment" for schools)
      // Optional: Add country bias (e.g., components: "country:us")
    });

    if (sessionToken) {
      params.append("sessiontoken", sessionToken);
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("Google Places Autocomplete API error:", response.status, response.statusText);
      return NextResponse.json(
        { success: false, error: "Failed to fetch autocomplete suggestions" },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Google Places API error status:", data.status, data.error_message);
      return NextResponse.json(
        { success: false, error: data.error_message || "Failed to fetch suggestions" },
        { status: 500 }
      );
    }

    // Transform predictions to simplified format
    const predictions = (data.predictions || []).map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      structuredFormatting: {
        mainText: prediction.structured_formatting?.main_text || "",
        secondaryText: prediction.structured_formatting?.secondary_text || "",
      },
    }));

    return NextResponse.json({
      success: true,
      predictions,
    });
  } catch (error) {
    console.error("Google Places Autocomplete error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
