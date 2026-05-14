import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function GET() {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.SCORE_TRACKER);
    if (!hasAccess) {
      return NextResponse.json({ 
        scoreTrackerEnabled: false, 
        restricted: true,
        message: "Score Tracker is not available on your current plan. Please upgrade to Team Plus to use this feature."
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { scoreTrackerEnabled: true },
    });

    return NextResponse.json({ scoreTrackerEnabled: user?.scoreTrackerEnabled ?? false });
  } catch (error) {
    console.error("Error fetching score tracker setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.SCORE_TRACKER);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Score Tracker is not available on your current plan. Please upgrade to Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const { enabled } = await request.json();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { scoreTrackerEnabled: Boolean(enabled) },
    });

    return NextResponse.json({ scoreTrackerEnabled: Boolean(enabled) });
  } catch (error) {
    console.error("Error updating score tracker setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}