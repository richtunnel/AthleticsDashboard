import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

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
