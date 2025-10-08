import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get("sport");
    const level = searchParams.get("level");
    const status = searchParams.get("status");
    const dateRange = searchParams.get("dateRange");

    // Build where clause
    const where: Prisma.GameWhereInput = {
      homeTeam: {
        organizationId: session.user.organizationId,
      },
    };

    // Filter by sport
    if (sport && sport !== "all") {
      where.homeTeam = {
        ...where.homeTeam,
        sport: { name: sport },
      };
    }

    // Filter by level
    if (level && level !== "all") {
      where.homeTeam = {
        ...where.homeTeam,
        level: level as any,
      };
    }

    // Filter by status
    if (status && status !== "all") {
      where.status = status as any;
    }

    // Filter by date range
    if (dateRange === "upcoming") {
      where.date = { gte: new Date() };
    } else if (dateRange === "past") {
      where.date = { lt: new Date() };
    }

    const games = await prisma.game.findMany({
      where,
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
        awayTeam: true,
        opponent: true,
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const game = await prisma.game.create({
      data: {
        ...body,
        createdById: session.user.id,
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }
}
