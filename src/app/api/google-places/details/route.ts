import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * Google Place Details API (Server-side)
 *
 * Purpose: Retrieves detailed information about a place (address, types, etc.)
 *
 * Request body:
 * - placeId: string (required) - Google Place ID
 * - sessionToken: string (optional) - For billing optimization
 *
 * Response:
 * - success: boolean
 * - result: { formattedAddress, addressComponents, types, isSchool, geometry }
 */
export async function POST(req: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_DISTANCE_API_KEY;
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("Google Maps API key not configured");
      return NextResponse.json({ success: false, error: "Google Maps API not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { placeId, sessionToken } = body;

    if (!placeId || typeof placeId !== "string") {
      return NextResponse.json({ success: false, error: "Place ID is required" }, { status: 400 });
    }

    // Build Google Place Details API URL
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_API_KEY,
      fields: "formatted_address,address_components,types,geometry",
    });

    if (sessionToken) {
      params.append("sessiontoken", sessionToken);
    }

    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
    });

    if (!response.ok) {
      console.error("Google Place Details API error:", response.status, response.statusText);
      return NextResponse.json({ success: false, error: "Failed to fetch place details" }, { status: 500 });
    }

    const data = await response.json();

    if (data.status !== "OK") {
      console.error("Google Place Details API error status:", data.status, data.error_message);
      return NextResponse.json({ success: false, error: data.error_message || "Failed to fetch place details" }, { status: 500 });
    }

    const result = data.result;

    // Detect if the place is a school based on types
    const schoolTypes = ["school", "university", "secondary_school", "primary_school", "educational_institution"];
    const isSchool = result.types?.some((type: string) => schoolTypes.includes(type.toLowerCase())) || false;

    // Transform to simplified format
    const placeDetails = {
      formattedAddress: result.formatted_address || "",
      addressComponents: result.address_components || [],
      types: result.types || [],
      isSchool,
      geometry: result.geometry || null,
    };

    return NextResponse.json({
      success: true,
      result: placeDetails,
    });
  } catch (error) {
    console.error("Google Place Details error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
