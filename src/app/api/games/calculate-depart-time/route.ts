import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { dismissDepartService } from "@/lib/services/dismiss-depart.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await request.json();
    const { gameId, dismissalTime } = body;

    if (!gameId || !dismissalTime) {
      return NextResponse.json(
        { error: "Missing required fields: gameId and dismissalTime" },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(dismissalTime)) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM (e.g., 14:30)" },
        { status: 400 }
      );
    }

    const recommendation = await dismissDepartService.calculateDepartureTime(
      gameId,
      organizationId,
      dismissalTime,
      session.user.id // Pass userId to get school address
    );

    return NextResponse.json({ success: true, data: recommendation });
  } catch (error: any) {
    console.error("Error calculating departure time:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate departure time" },
      { status: 500 }
    );
  }
}
