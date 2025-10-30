import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const teams = await prisma.team.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        sport: true,
      },
      orderBy: [{ sport: { name: "asc" } }, { level: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch teams",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // ✅ CHECK LIMIT: Max 20 unique levels per organization
    const uniqueLevels = await prisma.team.findMany({
      where: { organizationId: session.user.organizationId },
      select: { level: true },
      distinct: ["level"],
    });

    // Check if adding a new level
    const isNewLevel = !uniqueLevels.some((t) => t.level === body.level);
    if (isNewLevel && uniqueLevels.length >= 20) {
      return NextResponse.json({ success: false, error: "Maximum of 20 different levels reached for your organization" }, { status: 400 });
    }

    // ✅ CHECK LIMIT: Max 100 teams per organization (reasonable limit)
    const teamsCount = await prisma.team.count({
      where: { organizationId: session.user.organizationId },
    });

    if (teamsCount >= 100) {
      return NextResponse.json({ success: false, error: "Maximum of 100 teams reached for your organization" }, { status: 400 });
    }

    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: body,
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

    const team = await prisma.team.create({
      data: {
        ...body,
        organizationId: session.user.organizationId,
      },
      include: {
        sport: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: team,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create team",
      },
      { status: 500 }
    );
  }
}
