import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { travelAIService } from "@/lib/services/travelAI";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";
import { calendarService } from "@/lib/services/calendar.service";
import { normalizeTimeFormat } from "@/lib/utils/timeValidation";
import { rateLimit, RateLimitConfig, getClientIp } from "@/lib/security/rate-limiter";
import { applyAllSecurityHeaders } from "@/lib/security/security-headers";
import { filterRestrictedGameFields } from "@/lib/security/plan-limits";
import { sanitizeCustomFields, sanitizeObject } from "@/lib/utils/sanitizer";

export async function GET(request: NextRequest) {
  // Apply rate limiting for games API
  const { allowed: rateLimitAllowed, retryAfter } = await rateLimit(
    request,
    RateLimitConfig.games
  );

  if (!rateLimitAllowed) {
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
    response.headers.set('Retry-After', retryAfter?.toString() || '900');
    return applyAllSecurityHeaders(request, response);
  }

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
    const workbookId = searchParams.get("workbookId");

    // Build where clause
    const where: any = {
      homeTeam: {
        organizationId: session.user.organizationId,
      },
    };

    // Filter by workbook if provided
    if (workbookId) {
      where.workbookId = workbookId;
    }

    const travelRequiredParam = searchParams.get("travelRequired");
    if (travelRequiredParam === "true") {
      where.travelRequired = true;
    } else if (travelRequiredParam === "false") {
      where.travelRequired = false;
    }

    console.log("WHERE clause:", JSON.stringify(where, null, 2));

    // Process column filters
    const filterParams = Array.from(searchParams.entries()).filter(([key]) => key.startsWith("filter_"));

    // Group filters by column
    const columnFilters: Record<string, any> = {};
    filterParams.forEach(([key, value]) => {
      // Use more robust splitting to handle column IDs with underscores
      const suffixes = ["_secondValue", "_type", "_condition", "_value", "_values"];
      const suffix = suffixes.find((s) => key.endsWith(s));

      if (suffix) {
        const columnId = key.substring(7, key.lastIndexOf(suffix));
        const filterProp = suffix.substring(1); // remove leading underscore

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

    // Build orderBy based on sortBy parameter.
    // Prisma 6.x dropped JSON-path orderBy (customFields/customData path sorting),
    // so we handle those in-memory after fetching all matching rows.
    let orderBy: any = { date: "asc" };
    let jsonSortField: { source: "customData" | "customFields"; key: string } | null = null;

    if (sortBy.startsWith("custom:")) {
      jsonSortField = { source: "customData", key: sortBy.replace("custom:", "") };
    } else if (sortBy.startsWith("imported:")) {
      jsonSortField = { source: "customFields", key: sortBy.replace("imported:", "") };
    } else {
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
        case "notes":
          orderBy = { notes: sortOrder };
          break;
        case "sortOrder":
          orderBy = [{ sortOrder: sortOrder }, { date: "asc" }];
          break;
        default:
          orderBy = { date: "asc" };
      }
    }

    // Get total count for pagination
    const total = await prisma.game.count({ where });
    const totalCount = Number(total);

    const gameInclude = {
      homeTeam: {
        include: {
          sport: true,
          organization: true,
        },
      },
      awayTeam: true,
      opponent: true,
      venue: true,
    } as const;

    // Get games
    let games;
    if (jsonSortField) {
      // JSON field sorts can't be pushed to Prisma 6.x — fetch all matching rows,
      // sort in memory, then slice for the requested page.
      const { source, key } = jsonSortField;
      const allGames = await prisma.game.findMany({ where, include: gameInclude, orderBy: { date: "asc" } });
      allGames.sort((a, b) => {
        const av = String((a[source] as any)?.[key] ?? "");
        const bv = String((b[source] as any)?.[key] ?? "");
        if (av < bv) return sortOrder === "asc" ? -1 : 1;
        if (av > bv) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
      games = allGames.slice((page - 1) * limit, page * limit);
    } else {
      games = await prisma.game.findMany({
        where,
        include: gameInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      });
    }

    const serializedGames = games.map((game) => ({
      ...game,
      homeTeam: {
        ...game.homeTeam,
        organization: game.homeTeam.organization
          ? {
              ...game.homeTeam.organization,
              storageUsageBytes: Number(game.homeTeam.organization.storageUsageBytes),
              storageQuotaBytes: Number(game.homeTeam.organization.storageQuotaBytes),
            }
          : null,
      },
    }));

    // 🔍 DEBUG: Log first game's organization
    if (games.length > 0) {
      console.log("First game org ID:", games[0].homeTeam.organizationId);
      console.log("First game org name:", games[0].homeTeam.organization?.name);
      console.log("==================");
    }

    const totalPages = Math.ceil(totalCount / limit);

    const response = NextResponse.json({
      success: true,
      data: {
        games: serializedGames,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
    return applyAllSecurityHeaders(request, response);
  } catch (error) {
    console.error("Error fetching games:", error);
    const response = NextResponse.json(
      {
        success: false,
        error: "Failed to fetch games",
      },
      { status: 500 }
    );
    return applyAllSecurityHeaders(request, response);
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
        const orConditions = [{ opponent: { name: { in: values.filter((v) => v !== "TBD") } } }, { opponent: null }];
        if (where.OR) {
          where.AND = where.AND || [];
          where.AND.push({ OR: orConditions });
        } else {
          where.OR = orConditions;
        }
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
      // Handle location text field or venue names
      const locationValues = values.filter((v) => v !== "TBD");
      const includeTBD = values.includes("TBD");

      if (locationValues.length > 0 || includeTBD) {
        const orConditions: any[] = [];
        
        // Add conditions for actual location values
        if (locationValues.length > 0) {
          orConditions.push(
            { location: { in: locationValues } },
            { venue: { name: { in: locationValues } } }
          );
        }
        
        // Add condition for TBD (null locations and null venues)
        if (includeTBD) {
          orConditions.push(
            { AND: [{ location: null }, { venue: null }] }
          );
        }
        
        if (where.OR) {
          where.AND = where.AND || [];
          where.AND.push({ OR: orConditions });
        } else {
          where.OR = orConditions;
        }
      }
      break;

    case "isHome":
      // Only apply filter if not both selected
      const includeHome = values.includes("Home");
      const includeAway = values.includes("Away");
      
      if (includeHome && !includeAway) {
        where.isHome = true;
      } else if (!includeHome && includeAway) {
        where.isHome = false;
      }
      // If both or neither selected, don't filter (show all)
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

    case "notes": {
      const includeHas = values.includes("Has notes");
      const includeNone = values.includes("No notes");

      if (!where.AND) {
        where.AND = [];
      }

      if (includeHas && !includeNone) {
        where.AND.push({ notes: { not: null } });
      } else if (!includeHas && includeNone) {
        where.AND.push({ notes: null });
      }
      break;
    }

    case "date": {
      const dateConditions = values
        .map((v) => {
          // Month token: "month:YYYY-MM" → full calendar-month range
          if (v.startsWith("month:")) {
            const [yyyy, mm] = v.slice(6).split("-").map(Number);
            if (!yyyy || !mm) return null;
            const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0, 0));
            const end   = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59, 999)); // day 0 = last day of prev month
            return { date: { gte: start, lte: end } };
          }
          // Year token: "year:YYYY" → full calendar-year range
          if (v.startsWith("year:")) {
            const yyyy = Number(v.slice(5));
            if (!yyyy) return null;
            const start = new Date(Date.UTC(yyyy, 0, 1, 0, 0, 0, 0));
            const end   = new Date(Date.UTC(yyyy, 11, 31, 23, 59, 59, 999));
            return { date: { gte: start, lte: end } };
          }
          // Exact date: "YYYY-MM-DD"
          const d = new Date(v);
          if (isNaN(d.getTime())) return null;
          const start = new Date(d);
          start.setUTCHours(0, 0, 0, 0);
          const end = new Date(d);
          end.setUTCHours(23, 59, 59, 999);
          return { date: { gte: start, lte: end } };
        })
        .filter(Boolean);

      if (dateConditions.length > 0) {
        if (!where.AND) where.AND = [];
        where.AND.push({ OR: dateConditions });
      }
      break;
    }

    default:
      // Handle custom columns and imported columns
      if (columnId.startsWith("imported:")) {
        // Imported column - stored in customFields with column name
        const columnName = columnId.substring(9);
        if (columnName) {
          // Build OR conditions for each value to check in customFields
          const orConditions = values.map((value) => {
            const isDatePart = /^\d{4}-\d{2}-\d{2}$/.test(value);
            return {
              customFields: {
                path: [columnName],
                [isDatePart ? "string_contains" : "equals"]: value,
              },
            };
          });

          if (orConditions.length > 0) {
            if (where.OR) {
              // If OR already exists, combine with AND
              where.AND = where.AND || [];
              where.AND.push({ OR: orConditions });
            } else {
              where.OR = orConditions;
            }
          }
        }
      } else if (columnId.startsWith("custom:") || columnId.length > 10) {
        // Custom column - stored in customData
        const customId = columnId.startsWith("custom:") ? columnId.substring(7) : columnId;
        if (customId) {
          const orConditions = values.map((value) => {
            const isDatePart = /^\d{4}-\d{2}-\d{2}$/.test(value);
            return {
              customData: {
                path: [customId],
                [isDatePart ? "string_contains" : "equals"]: value,
              },
            };
          });

          if (orConditions.length > 0) {
            if (where.OR) {
              where.AND = where.AND || [];
              where.AND.push({ OR: orConditions });
            } else {
              where.OR = orConditions;
            }
          }
        }
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
      case "greaterThanOrEqual":
        return { gte: parseValue(value, columnId) };
      case "less_than":
        return { lt: parseValue(value, columnId) };
      case "lessThanOrEqual":
        return { lte: parseValue(value, columnId) };
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
      // Check both location field and venue name
      const locationCondition = buildCondition("location");
      const locationOrConditions = [
        { location: locationCondition },
        { venue: { name: buildCondition("name") } }
      ];
      if (where.OR) {
        where.AND = where.AND || [];
        where.AND.push({ OR: locationOrConditions });
      } else {
        where.OR = locationOrConditions;
      }
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

    case "date": {
      // Prisma DateTime fields require Date objects, not strings.
      // We also expand single-day "equals" into a gte/lte range so timezone
      // differences in stored values don't cause misses.
      const parseDate = (s: string) => {
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      };

      const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
      const endOfDay   = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

      // Handle no-value conditions BEFORE attempting to parse the date value
      if (condition === "is_empty") {
        where.date = { equals: null };
        break;
      }
      if (condition === "is_not_empty") {
        where.date = { not: null };
        break;
      }

      // Month-level filter: value is "YYYY-MM" (from <input type="month">)
      if (condition === "in_month") {
        const [yyyy, mm] = (value || "").split("-").map(Number);
        if (yyyy && mm) {
          const start = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0, 0));
          const end   = new Date(Date.UTC(yyyy, mm, 0, 23, 59, 59, 999)); // day 0 = last day of previous month
          where.date = { gte: start, lte: end };
        }
        break;
      }

      // Year-level filter: value is "YYYY" (from <input type="number">)
      if (condition === "in_year") {
        const yyyy = Number(value);
        if (yyyy) {
          const start = new Date(Date.UTC(yyyy, 0, 1, 0, 0, 0, 0));
          const end   = new Date(Date.UTC(yyyy, 11, 31, 23, 59, 59, 999));
          where.date = { gte: start, lte: end };
        }
        break;
      }

      const d1 = parseDate(value);
      if (!d1) break; // value is required but invalid/missing — skip filter

      switch (condition) {
        case "equals":
          // Match the whole day
          where.date = { gte: startOfDay(d1), lte: endOfDay(d1) };
          break;
        case "not_equals":
          // Exclude the whole day
          if (!where.AND) where.AND = [];
          where.AND.push({ OR: [{ date: { lt: startOfDay(d1) } }, { date: { gt: endOfDay(d1) } }] });
          break;
        case "greater_than": // "After"
          where.date = { gt: endOfDay(d1) };
          break;
        case "less_than": // "Before"
          where.date = { lt: startOfDay(d1) };
          break;
        case "between": {
          const d2 = parseDate(secondValue || "");
          if (!d2) {
            where.date = { gte: startOfDay(d1), lte: endOfDay(d1) };
          } else {
            // Swap if needed so start ≤ end
            const [lo, hi] = d1 <= d2 ? [d1, d2] : [d2, d1];
            where.date = { gte: startOfDay(lo), lte: endOfDay(hi) };
          }
          break;
        }
        default:
          break;
      }
      break;
    }

    case "time":
      where.time = buildCondition("time");
      break;

    case "notes":
      where.notes = buildCondition("notes");
      break;

    default:
      // Handle custom columns and imported columns with condition filtering
      if (columnId.startsWith("custom:")) {
        // Custom column - stored in customData with UUID
        const customId = columnId.substring(7);
        if (customId) {
          // Build condition based on filter type
          const jsonCondition: any = { path: [customId] };
          
          switch (condition) {
            case "equals":
              jsonCondition.equals = value;
              break;
            case "not_equals":
              jsonCondition.not = value;
              break;
            case "contains":
            case "starts_with":
            case "ends_with":
            case "not_contains":
              jsonCondition.string_contains = value;
              break;
            case "is_empty":
              jsonCondition.equals = null;
              break;
            case "is_not_empty":
              jsonCondition.not = null;
              break;
            default:
              jsonCondition.string_contains = value;
          }
          
          if (where.customData) {
            where.AND = where.AND || [];
            where.AND.push({ customData: jsonCondition });
          } else {
            where.customData = jsonCondition;
          }
        }
      } else if (columnId.startsWith("imported:")) {
        // Imported column - stored in customFields with column name
        const columnName = columnId.substring(9);
        if (columnName) {
          const jsonCondition: any = { path: [columnName] };
          
          switch (condition) {
            case "equals":
              jsonCondition.equals = value;
              break;
            case "not_equals":
              jsonCondition.not = value;
              break;
            case "contains":
            case "starts_with":
            case "ends_with":
            case "not_contains":
              jsonCondition.string_contains = value;
              break;
            case "is_empty":
              jsonCondition.equals = null;
              break;
            case "is_not_empty":
              jsonCondition.not = null;
              break;
            default:
              jsonCondition.string_contains = value;
          }
          
          if (where.customFields) {
            where.AND = where.AND || [];
            where.AND.push({ customFields: jsonCondition });
          } else {
            where.customFields = jsonCondition;
          }
        }
      } else if (columnId.length > 10) {
        // Legacy: Likely a UUID for custom column (backward compatibility)
        const jsonCondition = {
          path: [columnId],
          string_contains: value, // Prisma JSON filtering
        };
        if (where.customData) {
          where.AND = where.AND || [];
          where.AND.push({ customData: jsonCondition });
        } else {
          where.customData = jsonCondition;
        }
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
    let body = await request.json();

    // Filter restricted fields based on plan
    body = await filterRestrictedGameFields(session.user.id, body);

    // ✅ CHECK STORAGE LIMIT: Check if organization has space for new data
    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: body,
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

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

    // Normalize time field - convert empty strings to null and validate/normalize format
    if ('time' in body) {
      try {
        body.time = normalizeTimeFormat(body.time);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid time format";
        return NextResponse.json({ 
          success: false, 
          error: `${message}. Use HH:MM format (e.g., 14:30, 09:00) for Google Calendar compatibility.` 
        }, { status: 400 });
      }
    }

    // VALIDATE: notes field character limit
    const MAX_CHAR_LIMIT = 2500;
    if (body.notes && typeof body.notes === "string" && body.notes.length > MAX_CHAR_LIMIT) {
      return NextResponse.json({ success: false, error: `Notes field exceeds maximum length of ${MAX_CHAR_LIMIT} characters` }, { status: 400 });
    }

    // VALIDATE: location field character limit
    if (body.location && typeof body.location === "string" && body.location.length > MAX_CHAR_LIMIT) {
      return NextResponse.json({ success: false, error: `Location field exceeds maximum length of ${MAX_CHAR_LIMIT} characters` }, { status: 400 });
    }

    // VALIDATE: custom data fields character limits
    if (body.customData && typeof body.customData === "object") {
      for (const [key, value] of Object.entries(body.customData)) {
        if (typeof value === "string" && value.length > MAX_CHAR_LIMIT) {
          return NextResponse.json({ success: false, error: `Custom field "${key}" exceeds maximum length of ${MAX_CHAR_LIMIT} characters` }, { status: 400 });
        }
      }
    }

    // VALIDATE: custom fields (imported columns) character limits
    if (body.customFields && typeof body.customFields === "object") {
      for (const [key, value] of Object.entries(body.customFields)) {
        if (typeof value === "string" && value.length > MAX_CHAR_LIMIT) {
          return NextResponse.json({ success: false, error: `Imported field "${key}" exceeds maximum length of ${MAX_CHAR_LIMIT} characters` }, { status: 400 });
        }
      }
    }

    // SANITIZE: customFields and customData to prevent injection attacks
    if (body.customFields) {
      body.customFields = sanitizeCustomFields(body.customFields);
    }
    if (body.customData) {
      body.customData = sanitizeObject(body.customData, 0, {
        maxDepth: 5,
        maxStringLength: MAX_CHAR_LIMIT,
        maxKeys: 50,
        removeDangerousKeys: true,
        escapeHtml: true,
      });
    }

    let game = await prisma.game.create({
      data: {
        ...body,
        createdById: session.user.id,
        workbookId: body.workbookId,
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
        workbook: true,
      },
    });

    // Auto-generate travel recommendation if auto-fill is enabled and travel is required
    if (game.travelRequired) {
      try {
        const travelSettings = await prisma.travelSettings.findUnique({
          where: { organizationId: session.user.organizationId },
        });

        if (travelSettings?.autoFillEnabled && game.venue) {
          await travelAIService.createTravelRecommendation(game.id, session.user.organizationId, { autoApply: true });
          const refreshedGame = await prisma.game.findUnique({
            where: { id: game.id },
            include: {
              homeTeam: {
                include: { sport: true },
              },
              opponent: true,
              venue: true,
              workbook: true,
            },
          });

          if (refreshedGame) {
            game = refreshedGame;
          }
        }
      } catch (error) {
        console.error("Error checking travel settings:", error);
        // Don't fail the game creation if auto-fill fails
      }
    }

    // Auto-sync to calendar if enabled
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { autoCalendarSyncEnabled: true },
      });

      if (user?.autoCalendarSyncEnabled) {
        await calendarService.syncGameToCalendar(game.id, session.user.id);
      }
    } catch (error) {
      console.error("Error auto-syncing to calendar:", error);
      // Don't fail the game creation if auto-sync fails
    }

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
