import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get("name");

    // If name is provided, find specific sport
    if (name) {
      const sport = await prisma.sport.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
      });

      if (!sport) {
        return NextResponse.json({ success: false, error: "Sport not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: sport,
      });
    }

    // Otherwise return all sports
    const sports = await prisma.sport.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: sports,
    });
  } catch (error) {
    console.error("Error fetching sports:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch sports" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { name, season } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Sport name is required" }, { status: 400 });
    }

    // Check if sport already exists
    const existingSport = await prisma.sport.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    // If exists, return it
    if (existingSport) {
      return NextResponse.json({
        success: true,
        data: existingSport,
      });
    }

    // Create new sport
    const sport = await prisma.sport.create({
      data: {
        name,
        season: season || "FALL",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: sport,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating sport:", error);
    return NextResponse.json({ success: false, error: "Failed to create sport" }, { status: 500 });
  }
}
