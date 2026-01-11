import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.BUDGET_CALCULATOR);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Budget Calculator is not available on your current plan. Please upgrade to Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        costBudgetEnabled: true,
        monthlyBudget: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      costBudgetEnabled: user.costBudgetEnabled,
      monthlyBudget: user.monthlyBudget,
    });
  } catch (error) {
    console.error("Error fetching cost budget settings:", error);
    return NextResponse.json({ error: "Failed to fetch cost budget settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.BUDGET_CALCULATOR);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Budget Calculator is not available on your current plan. Please upgrade to Team Plus to use this feature." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { enabled, monthlyBudget } = body;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(enabled !== undefined && { costBudgetEnabled: enabled }),
        ...(monthlyBudget !== undefined && { monthlyBudget: monthlyBudget === "" ? null : parseFloat(monthlyBudget) }),
      },
      select: {
        costBudgetEnabled: true,
        monthlyBudget: true,
      },
    });

    return NextResponse.json({
      costBudgetEnabled: updatedUser.costBudgetEnabled,
      monthlyBudget: updatedUser.monthlyBudget,
    });
  } catch (error) {
    console.error("Error updating cost budget settings:", error);
    return NextResponse.json({ error: "Failed to update cost budget settings" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();

    // 1. Reset user's monthly budget
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        monthlyBudget: null,
      },
    });

    // 2. Reset costs for all games in the organization
    // Note: We use organizationId from session to ensure we clear all games for the school/org
    await prisma.game.updateMany({
      where: {
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      data: {
        cost: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cost and budget data reset successfully",
    });
  } catch (error) {
    console.error("Error resetting cost budget data:", error);
    return NextResponse.json({ error: "Failed to reset cost budget data" }, { status: 500 });
  }
}
