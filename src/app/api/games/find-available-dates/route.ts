import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { availableDatesService } from "@/lib/services/available-dates.service";
import { availableDatesAIService } from "@/lib/services/available-dates-ai.service";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, candidateDates, excludeDays, maxResults, useAI } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Parse query with AI if enabled
    let parsedQuery;
    let excludeTeamsPrompt;
    let dateRange;
    let minSpacing;
    let interpretation;
    let cleanPrompt = prompt; // Default to original prompt
    
    if (useAI !== false) { // Default to true
      try {
        parsedQuery = await availableDatesAIService.parseQuery(prompt);
        interpretation = parsedQuery.interpretation;
        
        // Extract exclude teams prompt if provided
        if (parsedQuery.excludeTeams && parsedQuery.excludeTeams.length > 0) {
          excludeTeamsPrompt = parsedQuery.excludeTeams
            .map(t => `${t.gender || ''} ${t.level || ''} ${t.sport || ''}`.trim())
            .join(' ');
        }
        
        // Extract date range if provided
        if (parsedQuery.dateRange) {
          dateRange = parsedQuery.dateRange;
        }
        
        // Extract minimum spacing if provided
        if (parsedQuery.minSpacing) {
          minSpacing = parsedQuery.minSpacing;
        }
        
        // CRITICAL FIX: Reconstruct clean team-only prompt from parsed targetTeams
        // This prevents constraint words (months, days, etc.) from interfering with team matching
        if (parsedQuery.targetTeams && parsedQuery.targetTeams.length > 0) {
          cleanPrompt = parsedQuery.targetTeams
            .map(t => `${t.gender || ''} ${t.level || ''} ${t.sport || ''}`.trim())
            .join(' ');
          console.log('Reconstructed clean prompt from AI parsed teams:', cleanPrompt);
        }
        
        console.log('Parsed query:', parsedQuery);
      } catch (error) {
        console.error('AI parsing failed, continuing with basic parsing:', error);
      }
    }

    // Validate excludeDays if provided
    if (excludeDays !== undefined && (!Array.isArray(excludeDays) || !excludeDays.every((d: any) => typeof d === 'number' && d >= 0 && d <= 6))) {
      return NextResponse.json(
        { error: "excludeDays must be an array of numbers between 0 and 6" },
        { status: 400 }
      );
    }

    // Validate maxResults if provided
    if (maxResults !== undefined && (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 50)) {
      return NextResponse.json(
        { error: "maxResults must be a number between 1 and 50" },
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

    // Find available dates using enhanced service with AI-parsed options
    // Use cleanPrompt (reconstructed from AI parsed teams) instead of original prompt
    const result = await availableDatesService.findAvailableDates(
      cleanPrompt,
      gamesTable,
      finalCandidateDates,
      { 
        maxResults: maxResults || 10, // Default 10, user can select 25 or 50
        threshold: 2.5,
        excludeDays: excludeDays || [], // Pass excluded days from UI
        excludeTeamsPrompt, // Teams whose dates should be avoided (from AI)
        dateRange, // Date range filter (from AI)
        minSpacing, // Minimum spacing between dates (from AI)
      }
    );

    // Add AI interpretation to debug info
    if (interpretation) {
      result.debug.interpretation = interpretation;
    }

    // Generate AI recommendation based on results
    if (useAI !== false && result.recommendations.length > 0) {
      try {
        const recommendation = await availableDatesAIService.generateRecommendation(
          prompt,
          result.recommendations,
          interpretation
        );
        if (recommendation) {
          result.debug.recommendation = recommendation;
        }
      } catch (error) {
        console.error("Failed to generate AI recommendation:", error);
      }
    }

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
