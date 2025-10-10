import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get("sport");
    const level = searchParams.get("level");
    const location = searchParams.get("location");
    const status = searchParams.get("status");
    const dateRange = searchParams.get("dateRange");
    const opponent = searchParams.get("opponent");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const sortBy = searchParams.get("sortBy") || "date";
    const sortOrder = searchParams.get("sortOrder") || "asc";

    // Build where clause
    const where: any = {
      homeTeam: {
        organizationId: session.user.organizationId,
      },
    };

    // Filter by sport
    if (sport && sport !== "all" && sport !== "") {
      where.homeTeam = {
        ...where.homeTeam,
        sport: { name: sport },
      };
    }

    // Filter by level
    if (level && level !== "all" && level !== "") {
      where.homeTeam = {
        ...where.homeTeam,
        level: level,
      };
    }

    // Filter by opponent
    if (opponent && opponent !== "all" && opponent !== "") {
      where.opponentId = opponent;
    }

    // Filter by status
    if (status && status !== "all" && status !== "") {
      where.status = status;
    }

    //Filter by location
    if (location && location !== "all" && location !== "") {
      where.venue = {
        location: location,
      };
    }

    // Filter by date range
    if (dateRange === "upcoming") {
      where.date = { gte: new Date() };
    } else if (dateRange === "past") {
      where.date = { lt: new Date() };
    }

    // Search filter
    if (search && search.trim() !== "") {
      where.OR = [
        { homeTeam: { name: { contains: search, mode: "insensitive" } } },
        { opponent: { name: { contains: search, mode: "insensitive" } } },
        { venue: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build orderBy based on sortBy parameter
    let orderBy: any = { date: "asc" };

    switch (sortBy) {
      case "date":
        orderBy = { date: sortOrder };
        break;
      case "time":
        orderBy = { time: sortOrder };
        break;
      case "isHome":
        orderBy = { isHome: sortOrder };
        break;
      case "status":
        orderBy = { status: sortOrder };
        break;
      case "location":
        orderBy = { venue: { name: sortOrder } };
        break;
      default:
        orderBy = { date: "asc" };
    }

    // Get total count for pagination
    const total = await prisma.game.count({ where });

    // Get paginated games
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
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        games,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch games",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

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

    return NextResponse.json(
      {
        success: true,
        data: game,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create game",
      },
      { status: 500 }
    );
  }
}
