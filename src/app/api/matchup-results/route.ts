import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.SCORE_TRACKER);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Score Tracker is not available on your current plan. Please upgrade to Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const matchupResults = await prisma.matchupResult.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        opponent: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: matchupResults,
    });
  } catch (error) {
    console.error("Error fetching matchup results:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch matchup results",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.SCORE_TRACKER);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Score Tracker is not available on your current plan. Please upgrade to Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { opponentId, organizationScore, opponentScore, isWin, sport, gender, level } = body;

    if (!opponentId) {
      return NextResponse.json(
        { success: false, error: "Opponent is required" },
        { status: 400 }
      );
    }

    if (organizationScore === undefined || opponentScore === undefined) {
      return NextResponse.json(
        { success: false, error: "Scores are required" },
        { status: 400 }
      );
    }

    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: body,
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

    const matchupResult = await prisma.matchupResult.create({
      data: {
        opponentId,
        organizationScore: parseInt(organizationScore),
        opponentScore: parseInt(opponentScore),
        isWin: Boolean(isWin),
        sport: sport || null,
        gender: gender || null,
        level: level || null,
        organizationId: session.user.organizationId,
      },
      include: {
        opponent: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: matchupResult,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating matchup result:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create matchup result",
      },
      { status: 500 }
    );
  }
}
