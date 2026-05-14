import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { travelEnhancedService } from "@/lib/services/travel-enhanced.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await req.json();
    const { gameId, recommendationId } = body;

    if (!gameId || !recommendationId) {
      return NextResponse.json(
        { error: "gameId and recommendationId are required" },
        { status: 400 }
      );
    }

    await travelEnhancedService.applyTravelRecommendationToGame(
      gameId,
      recommendationId,
      organizationId
    );

    return NextResponse.json({
      success: true,
      message: "Travel recommendation applied to game",
    });
  } catch (error) {
    console.error("Apply travel recommendation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply recommendation" },
      { status: 500 }
    );
  }
}
