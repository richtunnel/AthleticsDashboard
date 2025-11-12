import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { travelEnhancedService } from "@/lib/services/travel-enhanced.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await req.json();
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    const travelInfo = await travelEnhancedService.getEnhancedTravelInfo(
      gameId,
      organizationId
    );

    await travelEnhancedService.updateGameWithEnhancedTravelInfo(gameId, organizationId);

    return NextResponse.json({
      success: true,
      travelInfo,
    });
  } catch (error) {
    console.error("Enhanced travel info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get travel info" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    const travelInfo = await travelEnhancedService.getEnhancedTravelInfo(
      gameId,
      organizationId
    );

    return NextResponse.json({
      success: true,
      travelInfo,
    });
  } catch (error) {
    console.error("Enhanced travel info error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get travel info" },
      { status: 500 }
    );
  }
}
