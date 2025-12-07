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
    const { prompt, candidateDates, excludeDays } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate excludeDays if provided
    if (excludeDays !== undefined && (!Array.isArray(excludeDays) || !excludeDays.every((d: any) => typeof d === 'number' && d >= 0 && d <= 6))) {
      return NextResponse.json(
        { error: "excludeDays must be an array of numbers between 0 and 6" },
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
      // Default: generate next 3 months as candidate pool
      finalCandidateDates = [];
      const today = new Date();
      const threeMonthsLater = new Date(today);
      threeMonthsLater.setMonth(today.getMonth() + 3);
      
      const current = new Date(today);
      while (current <= threeMonthsLater) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        finalCandidateDates.push(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
      }
    }

    // Find available dates using rule-based service
    const result = await availableDatesService.findAvailableDates(
      prompt,
      gamesTable,
      finalCandidateDates,
      { 
        maxResults: 50, 
        threshold: 2.5,
        excludeDays: excludeDays || [] // Pass excluded days
      }
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
