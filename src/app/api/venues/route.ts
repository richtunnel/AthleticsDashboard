import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const venues = await prisma.venue.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data: venues,
    });
  } catch (error) {
    console.error("Error fetching venues:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch venues",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const venue = await prisma.venue.create({
      data: {
        ...body,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: venue,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating venue:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create venue",
      },
      { status: 500 }
    );
  }
}
