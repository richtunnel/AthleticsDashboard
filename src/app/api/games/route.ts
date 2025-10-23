import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    console.log("=== GAMES API DEBUG ===");
    console.log("User ID:", session.user.id);
    console.log("User Email:", session.user.email);
    console.log("Organization ID:", session.user.organizationId);
    console.log("====================");

    const searchParams = request.nextUrl.searchParams;

    // Pagination
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

    console.log("WHERE clause:", JSON.stringify(where, null, 2));

    // Process column filters
    const filterParams = Array.from(searchParams.entries()).filter(([key]) => key.startsWith("filter_"));

    // Group filters by column
    const columnFilters: Record<string, any> = {};
    filterParams.forEach(([key, value]) => {
      const parts = key.split("_");
      if (parts.length >= 3) {
        const columnId = parts[1];
        const filterProp = parts.slice(2).join("_");

        if (!columnFilters[columnId]) {
          columnFilters[columnId] = {};
        }

        columnFilters[columnId][filterProp] = value;
      }
    });

    // Apply filters
    Object.entries(columnFilters).forEach(([columnId, filter]) => {
      const filterType = filter.type;

      if (filterType === "values") {
        // Filter by selected values
        const values = JSON.parse(filter.values || "[]");
        if (values.length > 0) {
          applyValueFilter(where, columnId, values);
        }
      } else if (filterType === "condition") {
        // Filter by condition
        const condition = filter.condition;
        const value = filter.value;
        const secondValue = filter.secondValue;

        applyConditionFilter(where, columnId, condition, value, secondValue);
      }
    });

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
      case "sport":
        orderBy = { homeTeam: { sport: { name: sortOrder } } };
        break;
      case "level":
        orderBy = { homeTeam: { level: sortOrder } };
        break;
      case "opponent":
        orderBy = { opponent: { name: sortOrder } };
        break;
      case "busTravel":
        orderBy = { busTravel: sortOrder };
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
            organization: true,
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

    // 🔍 DEBUG: Log first game's organization
    if (games.length > 0) {
      console.log("First game org ID:", games[0].homeTeam.organizationId);
      console.log("First game org name:", games[0].homeTeam.organization?.name);
      console.log("==================");
    }

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

// Helper function to apply value filters
function applyValueFilter(where: any, columnId: string, values: string[]) {
  switch (columnId) {
    case "sport":
      where.homeTeam = {
        ...where.homeTeam,
        sport: {
          name: { in: values },
        },
      };
      break;

    case "level":
      where.homeTeam = {
        ...where.homeTeam,
        level: { in: values },
      };
      break;

    case "opponent":
      // Handle "TBD" case
      if (values.includes("TBD")) {
        where.OR = [{ opponent: { name: { in: values.filter((v) => v !== "TBD") } } }, { opponent: null }];
      } else {
        where.opponent = {
          name: { in: values },
        };
      }
      break;

    case "status":
      where.status = { in: values };
      break;

    case "location":
      // Handle Home/Away and venue names
      const hasHome = values.some((v) => v === "Home" || v === "Home Field");
      const venueNames = values.filter((v) => v !== "Home" && v !== "Home Field" && v !== "TBD");

      if (hasHome && venueNames.length > 0) {
        where.OR = [{ isHome: true }, { venue: { name: { in: venueNames } } }];
      } else if (hasHome) {
        where.isHome = true;
      } else if (venueNames.length > 0) {
        where.venue = {
          name: { in: venueNames },
        };
      }
      break;

    case "isHome":
      where.isHome = values.includes("Home");
      break;

    case "busTravel": {
      const includeYes = values.includes("Yes");
      const includeNo = values.includes("No");

      if (includeYes && !includeNo) {
        where.busTravel = true;
      } else if (!includeYes && includeNo) {
        where.busTravel = false;
      }
      break;
    }

    case "date":
      // For date, we'd need to parse the dates
      const dates = values.map((v) => new Date(v));
      where.date = { in: dates };
      break;

    default:
      // Custom column
      if (columnId.length > 10) {
        // Likely a UUID for custom column
        where.customData = {
          path: [columnId],
          in: values,
        };
      }
      break;
  }
}

// Helper function to apply condition filters
function applyConditionFilter(where: any, columnId: string, condition: string, value: string, secondValue?: string) {
  const buildCondition = (field: any) => {
    switch (condition) {
      case "equals":
        return { equals: value };
      case "not_equals":
        return { not: value };
      case "contains":
        return { contains: value, mode: "insensitive" };
      case "not_contains":
        return { not: { contains: value, mode: "insensitive" } };
      case "starts_with":
        return { startsWith: value, mode: "insensitive" };
      case "ends_with":
        return { endsWith: value, mode: "insensitive" };
      case "is_empty":
        return { equals: null };
      case "is_not_empty":
        return { not: null };
      case "greater_than":
        return { gt: parseValue(value, columnId) };
      case "less_than":
        return { lt: parseValue(value, columnId) };
      case "between":
        return {
          gte: parseValue(value, columnId),
          lte: parseValue(secondValue || value, columnId),
        };
      default:
        return { contains: value, mode: "insensitive" };
    }
  };

  switch (columnId) {
    case "sport":
      where.homeTeam = {
        ...where.homeTeam,
        sport: {
          name: buildCondition("name"),
        },
      };
      break;

    case "level":
      where.homeTeam = {
        ...where.homeTeam,
        level: buildCondition("level"),
      };
      break;

    case "opponent":
      where.opponent = {
        name: buildCondition("name"),
      };
      break;

    case "status":
      where.status = buildCondition("status");
      break;

    case "location":
      where.venue = {
        name: buildCondition("name"),
      };
      break;

    case "busTravel": {
      if (!value && condition !== "is_empty" && condition !== "is_not_empty") {
        break;
      }

      const boolValue = parseBoolean(value);
      switch (condition) {
        case "not_equals":
        case "not_contains":
          where.busTravel = { not: boolValue };
          break;
        case "is_empty":
          where.busTravel = false;
          break;
        case "is_not_empty":
          where.busTravel = true;
          break;
        default:
          where.busTravel = boolValue;
      }
      break;
    }

    case "date":
      where.date = buildCondition("date");
      break;

    case "time":
      where.time = buildCondition("time");
      break;

    default:
      // Custom column - use JSON filtering
      if (columnId.length > 10) {
        where.customData = {
          path: [columnId],
          string_contains: value, // Prisma JSON filtering
        };
      }
      break;
  }
}

// Helper to parse values based on column type
function parseValue(value: string, columnId: string): any {
  if (columnId === "date") {
    return new Date(value);
  }
  if (columnId === "time") {
    return value;
  }
  // Try to parse as number
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num;
  }
  return value;
}

function parseBoolean(value: string): boolean {
  return ["true", "yes", "1"].includes((value || "").toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    // ✅ CHECK LIMIT: Max 2500 games per organization
    const gamesCount = await prisma.game.count({
      where: {
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (gamesCount >= 2500) {
      return NextResponse.json({ success: false, error: "Maximum of 2,500 games reached for your organization" }, { status: 400 });
    }

    // VALIDATE: homeTeam belongs to user's organization
    const homeTeam = await prisma.team.findUnique({
      where: { id: body.homeTeamId },
      select: { organizationId: true },
    });

    if (!homeTeam || homeTeam.organizationId !== session.user.organizationId) {
      return NextResponse.json({ success: false, error: "Invalid home team" }, { status: 403 });
    }

    // VALIDATE: awayTeam (if provided) belongs to user's organization
    if (body.awayTeamId) {
      const awayTeam = await prisma.team.findUnique({
        where: { id: body.awayTeamId },
        select: { organizationId: true },
      });

      if (!awayTeam || awayTeam.organizationId !== session.user.organizationId) {
        return NextResponse.json({ success: false, error: "Invalid away team" }, { status: 403 });
      }
    }

    // VALIDATE: venue (if provided) belongs to user's organization
    if (body.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: body.venueId },
        select: { organizationId: true },
      });

      if (!venue || venue.organizationId !== session.user.organizationId) {
        return NextResponse.json({ success: false, error: "Invalid venue" }, { status: 403 });
      }
    }

    // VALIDATE: opponent (if provided) belongs to user's organization
    if (body.opponentId) {
      const opponent = await prisma.opponent.findUnique({
        where: { id: body.opponentId },
        select: { organizationId: true },
      });

      if (!opponent || opponent.organizationId !== session.user.organizationId) {
        return NextResponse.json({ success: false, error: "Invalid opponent" }, { status: 403 });
      }
    }

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
