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
      orderBy: {
        name: "asc",
      },
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

    const opponent = await prisma.opponent.create({
      data: {
        ...body,
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
