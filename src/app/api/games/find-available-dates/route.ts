import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { availableDatesAIService, ParsedQueryWithMeta } from "@/lib/services/available-dates-ai.service";
import { scanWorksheet, generateCandidateDates } from "@/lib/availability/worksheetScanner";
import { fallbackParse } from "@/lib/availability/fallbackParser";
import { trackServerEvent } from "@/lib/analytics/mixpanel.server";
import { prisma } from "@/lib/database/prisma";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.FIND_DATES);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "This feature is not available on your current plan. Please upgrade to Team or Team Plus to use Find Dates.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { prompt, candidateDates, excludeDays, maxResults, useAI, year } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    if (
      year !== undefined &&
      (typeof year !== "number" || year < 2000 || year > 2100)
    ) {
      return NextResponse.json(
        { error: "year must be a number between 2000 and 2100" },
        { status: 400 }
      );
    }

    if (
      excludeDays !== undefined &&
      (!Array.isArray(excludeDays) ||
        !excludeDays.every(
          (d: any) => typeof d === "number" && d >= 0 && d <= 6
        ))
    ) {
      return NextResponse.json(
        { error: "excludeDays must be an array of numbers between 0 and 6" },
        { status: 400 }
      );
    }

    if (
      maxResults !== undefined &&
      (typeof maxResults !== "number" || maxResults < 1 || maxResults > 50)
    ) {
      return NextResponse.json(
        { error: "maxResults must be a number between 1 and 50" },
        { status: 400 }
      );
    }

    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 }
      );
    }

    // Parse the natural-language prompt (AI + deterministic fallback)
    const getFallback = (): ParsedQueryWithMeta => {
      const { query } = fallbackParse(prompt);
      return { ...query, _parseMethod: "fallback", _latencyMs: 0 };
    };

    let parsedQuery: ParsedQueryWithMeta;
    if (useAI !== false) {
      try {
        parsedQuery = await availableDatesAIService.parseQuery(prompt);
      } catch (error) {
        console.error("AI parsing failed, continuing with fallback:", error);
        parsedQuery = getFallback();
      }
    } else {
      parsedQuery = getFallback();
    }

    // Merge UI-level excludeDays into the parsed query (UI takes precedence for explicit selections)
    const effectiveExcludeDays: number[] = [
      ...new Set([
        ...(excludeDays ?? []),
        ...(parsedQuery.excludeDays ?? []),
      ]),
    ];

    if (effectiveExcludeDays.length > 0) {
      parsedQuery.excludeDays = effectiveExcludeDays;
    }

    // Apply the user-selected maxResults override
    parsedQuery.maxResults = maxResults ?? parsedQuery.maxResults ?? 10;

    // Apply year override from UI.
    //
    // The user's UI year selection is authoritative. The AI parser might have
    // already inferred a start/end in a DIFFERENT year for prompts like
    // "in February" (it picks the next-occurring February). If we only set
    // `dateRange.year` but leave the AI's start/end alone, the candidate
    // generator uses the start/end branch (in the wrong year) and the
    // downstream year filter then strips every candidate → zero results.
    //
    // Fix: retarget start/end to the chosen year so the whole pipeline agrees.
    if (year !== undefined) {
      if (!parsedQuery.dateRange) parsedQuery.dateRange = {};
      parsedQuery.dateRange.year = year;

      const retargetYear = (iso: string | undefined | null): string | undefined => {
        if (!iso) return iso ?? undefined;
        if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
        const curYr = parseInt(iso.substring(0, 4), 10);
        if (curYr === year) return iso;
        return `${year}${iso.substring(4)}`;
      };
      parsedQuery.dateRange.start = retargetYear(parsedQuery.dateRange.start);
      parsedQuery.dateRange.end = retargetYear(parsedQuery.dateRange.end);
    }

    // Fetch all games for the organization
    const allGames = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
        opponent: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const GENDER_MAP: Record<string, string> = {
      MALE: "Boys",
      FEMALE: "Girls",
      COED: "Coed",
    };
    const LEVEL_MAP: Record<string, string> = {
      VARSITY: "Varsity",
      JV: "Junior Varsity",
      FRESHMAN: "Freshmen",
      MIDDLE_SCHOOL: "Middle School",
      YOUTH: "Youth",
    };

    const gamesTable = allGames.map((game) => {
      const customFields = game.customFields as Record<string, any> | null;
      const rawGender = game.homeTeam.gender as string | null;
      const rawLevel = game.homeTeam.level as string | null;
      const gender = (rawGender && GENDER_MAP[rawGender]) || rawGender || "";
      const level = (rawLevel && LEVEL_MAP[rawLevel]) || rawLevel || "";
      const sport = game.homeTeam.sport.name;
      return {
        // Spread custom fields FIRST so they never overwrite our canonical fields.
        // (Some spreadsheets have a "team" column, e.g. "Tigers Boys Varsity", which
        // would otherwise clobber the canonical "Boys Varsity Basketball" value and
        // break pattern matching in the availability service.)
        ...(customFields || {}),
        date: game.date,
        sport,
        level,
        gender,
        // Canonical "Boys Varsity Basketball" form — always present for phrase matching.
        team: `${gender} ${level} ${sport}`.trim(),
        // Raw home-team name (e.g. "Tigers Boys Varsity") kept for cross-field gender
        // detection when gender is stored in the team name rather than its own column.
        homeTeamName: game.homeTeam.name || null,
        description: game.notes,
        title: game.opponent?.name || null,
      };
    });

    // Generate candidate dates (or use provided ones)
    let finalCandidateDates: string[];
    if (
      candidateDates &&
      Array.isArray(candidateDates) &&
      candidateDates.length > 0
    ) {
      finalCandidateDates = candidateDates;
    } else {
      finalCandidateDates = generateCandidateDates(parsedQuery, new Date());
      console.log(
        `Generated ${finalCandidateDates.length} candidate dates via worksheetScanner`
      );
    }

    // Run the worksheet scanner
    const scanResult = await scanWorksheet({
      query: parsedQuery,
      gamesTable,
      candidateDates: finalCandidateDates,
    });

    // Apply final maxResults limit (scanner may return up to 50)
    const finalRecommendations = scanResult.recommendations.slice(
      0,
      parsedQuery.maxResults
    );
    scanResult.recommendations = finalRecommendations;

    // Generate AI recommendation based on results
    if (useAI !== false && scanResult.recommendations.length > 0) {
      try {
        const recommendation = await availableDatesAIService.generateRecommendation(
          prompt,
          scanResult.recommendations,
          parsedQuery.interpretation
        );
        if (recommendation) {
          scanResult.debug.recommendation = recommendation;
        }
      } catch (error) {
        console.error("Failed to generate AI recommendation:", error);
      }
    }

    trackServerEvent("Available Dates - Request", {
      parseMethod: parsedQuery._parseMethod,
      latencyMs: parsedQuery._latencyMs,
      datesFound: scanResult.recommendations.length,
      hasWeekdayFilter: (parsedQuery.weekdaysToInclude?.length ?? 0) > 0,
      hasMonthFilter: !!(
        parsedQuery.dateRange?.month || parsedQuery.dateRange?.months
      ),
      hasRelativeDate: !!(
        parsedQuery.dateRange?.start && parsedQuery.dateRange?.end
      ),
      organizationId,
    });

    return NextResponse.json({
      recommendations: scanResult.recommendations,
      debug: {
        ...scanResult.debug,
        weekdaysIncluded: scanResult.weekdaysIncluded,
        weekOfMonthFilter: scanResult.weekOfMonthFilter,
        parseMethod: parsedQuery._parseMethod,
      },
      aiQuotaExceeded: parsedQuery._parseMethod === "fallback-quota",
      parseMethod: parsedQuery._parseMethod,
    });
  } catch (error) {
    console.error("Find available dates API error:", error);
    // Find Dates is a flagship AD feature — every failure goes to critical-errors.
    const { reportCriticalError } = await import("@/lib/utils/reportCriticalError");
    await reportCriticalError(request, error, { source: "/api/games/find-available-dates" });

    return NextResponse.json(
      { error: "Failed to find available dates" },
      { status: 500 }
    );
  }
}
