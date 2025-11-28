import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { availableDatesService } from "@/lib/services/available-dates.service";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, candidateDates } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Get user's organization from session
    const organizationId = (session.user as any).organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimit = await availableDatesService.checkRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: `Rate limit exceeded. You can make ${rateLimit.remaining} more requests. Limit resets at ${rateLimit.resetAt.toLocaleString()}.`,
          recommendations: [],
          debug: { parsedTokens: [], matchedClusters: [], clusterDates: [], notes: ['Rate limit exceeded'] }
        },
        { status: 429 }
      );
    }

    // Log the request for rate limiting
    await availableDatesService.logRequest(session.user.id, prompt);

    // Fetch all games for the organization to use as gamesTable
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
        date: 'asc',
      },
    });

    // Convert Prisma games to GameRow format
    const gamesTable = allGames.map(game => {
      const customFields = game.customFields as Record<string, any> | null;
      return {
        date: game.date,
        sport: game.homeTeam.sport.name,
        level: game.homeTeam.level,
        gender: game.homeTeam.gender,
        team: `${game.homeTeam.gender} ${game.homeTeam.level} ${game.homeTeam.sport.name}`,
        description: game.notes,
        title: game.opponent?.name || null,
        ...(customFields || {}),
      };
    });

    // Generate candidateDates if not provided
    let finalCandidateDates: string[];
    if (candidateDates && Array.isArray(candidateDates) && candidateDates.length > 0) {
      finalCandidateDates = candidateDates;
    } else {
      // Default: generate next 90 days as candidate pool
      finalCandidateDates = [];
      const today = new Date();
      for (let i = 0; i < 90; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        finalCandidateDates.push(`${year}-${month}-${day}`);
      }
    }

    // Find available dates using rule-based service
    const result = await availableDatesService.findAvailableDates(
      prompt,
      gamesTable,
      finalCandidateDates,
      { maxResults: 6, threshold: 2.5 }
    );

    return NextResponse.json({
      recommendations: result.recommendations,
      debug: result.debug,
    });
  } catch (error) {
    console.error("Find available dates API error:", error);
    return NextResponse.json(
      { error: "Failed to find available dates" },
      { status: 500 }
    );
  }
}
