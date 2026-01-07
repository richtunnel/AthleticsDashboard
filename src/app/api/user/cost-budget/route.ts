import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

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
