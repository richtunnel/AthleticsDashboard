import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function GET() {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.TRAVEL_RECOMMENDATIONS);
    if (!hasAccess) {
      return NextResponse.json({ 
        success: true, 
        aiTravelTimesEnabled: false,
        restricted: true,
        message: "Travel Recommendations are not available on your current plan. Please upgrade to Team or Team Plus to use this feature."
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiTravelTimesEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      aiTravelTimesEnabled: user.aiTravelTimesEnabled,
    });
  } catch (error) {
    console.error("Error fetching AI travel times setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.TRAVEL_RECOMMENDATIONS);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Travel Recommendations are not available on your current plan. Please upgrade to Team or Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid request: enabled must be a boolean" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        aiTravelTimesEnabled: enabled,
      },
      select: {
        aiTravelTimesEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      aiTravelTimesEnabled: user.aiTravelTimesEnabled,
    });
  } catch (error) {
    console.error("Error updating AI travel times setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
