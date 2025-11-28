import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { availableDatesService } from "@/lib/services/available-dates.service";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, sport, level } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Get user's organization from session
    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 }
      );
    }

    // Find available dates
    const result = await availableDatesService.findAvailableDatesFromPrompt(
      session.user.id,
      organizationId,
      prompt,
      sport,
      level
    );

    // If there's an error (rate limit or other), return it
    if (result.error) {
      return NextResponse.json(
        { 
          availableDates: [],
          constraints: result.constraints,
          reasoning: result.reasoning,
          error: result.error 
        },
        { status: result.error.includes('Rate limit') ? 429 : 400 }
      );
    }

    return NextResponse.json({
      availableDates: result.availableDates,
      recommendations: result.recommendations,
      constraints: result.constraints,
      reasoning: result.reasoning,
      sport: result.constraints.homeOnly !== undefined || result.constraints.awayOnly !== undefined 
        ? sport 
        : undefined,
      level: result.constraints.homeOnly !== undefined || result.constraints.awayOnly !== undefined
        ? level
        : undefined,
    });
  } catch (error) {
    console.error("Find available dates API error:", error);
    return NextResponse.json(
      { error: "Failed to find available dates" },
      { status: 500 }
    );
  }
}
