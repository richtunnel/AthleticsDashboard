import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const opponents = await prisma.opponent.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: opponents,
    });
  } catch (error) {
    console.error("Error fetching opponents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch opponents",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // ✅ CHECK LIMIT: Max 100 opponents per organization
    const opponentsCount = await prisma.opponent.count({
      where: { organizationId: session.user.organizationId },
    });

    if (opponentsCount >= 100) {
      return NextResponse.json({ success: false, error: "Maximum of 100 opponents reached for your organization" }, { status: 400 });
    }

    // Get the highest sort order for this organization
    const highestSortOrder = await prisma.opponent.findFirst({
      where: { organizationId: session.user.organizationId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const nextSortOrder = (highestSortOrder?.sortOrder || 0) + 1;

    const opponent = await prisma.opponent.create({
      data: {
        ...body,
        sortOrder: nextSortOrder,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: opponent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating opponent:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create opponent",
      },
      { status: 500 }
    );
  }
}
