import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { availableDatesService } from "@/lib/services/available-dates.service";
import { availableDatesAIService } from "@/lib/services/available-dates-ai.service";
import { prisma } from "@/lib/database/prisma";
import { hasFeatureAccess, PlanFeature } from "@/lib/security/plan-limits";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Feature access check
    const hasAccess = await hasFeatureAccess(session.user.id, PlanFeature.FIND_DATES);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "This feature is not available on your current plan. Please upgrade to Team or Team Plus to use Find Dates." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { prompt, candidateDates, excludeDays, maxResults, useAI, year } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate year if provided
    if (year !== undefined && (typeof year !== 'number' || year < 2000 || year > 2100)) {
      return NextResponse.json(
        { error: "year must be a number between 2000 and 2100" },
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

    // Map Prisma enum values to the human-readable strings used in canonical-sports.json
    // so that extractClusterDates pattern matching works correctly.
    const GENDER_MAP: Record<string, string> = {
      MALE: 'Boys',
      FEMALE: 'Girls',
      COED: 'Coed',
    };
    const LEVEL_MAP: Record<string, string> = {
      VARSITY: 'Varsity',
      JV: 'Junior Varsity',
      FRESHMAN: 'Freshmen',
      MIDDLE_SCHOOL: 'Middle School',
      YOUTH: 'Youth',
    };

    // Convert Prisma games to GameRow format
    const gamesTable = allGames.map(game => {
      const customFields = game.customFields as Record<string, any> | null;
      const rawGender = game.homeTeam.gender as string | null;
      const rawLevel = game.homeTeam.level as string | null;
      const gender = (rawGender && GENDER_MAP[rawGender]) || rawGender || '';
      const level = (rawLevel && LEVEL_MAP[rawLevel]) || rawLevel || '';
      const sport = game.homeTeam.sport.name;
      return {
        date: game.date,
        sport,
        level,
        gender,
        team: `${gender} ${level} ${sport}`,
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
      // If year is provided, generate candidates for entire year
      // If specific month is mentioned in dateRange, generate candidates for that month
      // Otherwise, default to next 12 months as candidate pool
      finalCandidateDates = [];
      const today = new Date();

      // If year is explicitly provided, generate all dates for that year
      if (year !== undefined) {
        const startDate = new Date(year, 0, 1); // January 1st of the specified year
        const endDate = new Date(year, 11, 31); // December 31st of the specified year

        const current = new Date(startDate);
        while (current <= endDate) {
          const yearNum = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          finalCandidateDates.push(`${yearNum}-${month}-${day}`);
          current.setDate(current.getDate() + 1);
        }

        console.log(`Generated ${finalCandidateDates.length} candidate dates for year ${year}`);
      }
      else if (dateRange?.months && Array.isArray(dateRange.months) && dateRange.months.length > 0) {
        // Generate dates for multiple specified months
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        
        const allMonthDates: string[] = [];
        
        // If a specific year is provided, use it; otherwise use current year logic
        const targetYear = year !== undefined ? year : today.getFullYear();
        
        for (const monthName of dateRange.months) {
          const targetMonthIndex = monthNames.indexOf(monthName.toLowerCase());
          
          if (targetMonthIndex !== -1) {
            // Generate all dates in the target month for the target year
            const startDate = new Date(targetYear, targetMonthIndex, 1);
            const endDate = new Date(targetYear, targetMonthIndex + 1, 0); // Last day of month
            
            const current = new Date(startDate);
            while (current <= endDate) {
              const year = current.getFullYear();
              const month = String(current.getMonth() + 1).padStart(2, '0');
              const day = String(current.getDate()).padStart(2, '0');
              allMonthDates.push(`${year}-${month}-${day}`);
              current.setDate(current.getDate() + 1);
            }
            
            console.log(`Generated ${endDate.getDate()} candidate dates for ${monthName} ${targetYear}`);
          }
        }
        
        // Sort all dates chronologically
        finalCandidateDates = allMonthDates.sort();
        console.log(`Total ${finalCandidateDates.length} candidate dates across ${dateRange.months.length} months`);
      } else if (dateRange?.month) {
        // Generate dates for a single specified month (backward compatibility)
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const targetMonthIndex = monthNames.indexOf(dateRange.month.toLowerCase());
        
        if (targetMonthIndex !== -1) {
          // If a specific year is provided, use it; otherwise use current year logic
          const targetYear = year !== undefined ? year : today.getFullYear();
          
          // Generate all dates in the target month
          const startDate = new Date(targetYear, targetMonthIndex, 1);
          const endDate = new Date(targetYear, targetMonthIndex + 1, 0); // Last day of month
          
          const current = new Date(startDate);
          while (current <= endDate) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            finalCandidateDates.push(`${year}-${month}-${day}`);
            current.setDate(current.getDate() + 1);
          }
          
          console.log(`Generated ${finalCandidateDates.length} candidate dates for ${dateRange.month} ${targetYear}`);
        }
      } else if (dateRange?.start || dateRange?.end) {
        // If specific date range provided, generate candidates within that range
        const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : today;
        const endDate = dateRange.end ? new Date(dateRange.end + 'T00:00:00') : new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
        
        const current = new Date(startDate);
        while (current <= endDate) {
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          finalCandidateDates.push(`${year}-${month}-${day}`);
          current.setDate(current.getDate() + 1);
        }
        
        console.log(`Generated ${finalCandidateDates.length} candidate dates from ${dateRange.start || 'today'} to ${dateRange.end || '90 days'}`);
      } else {
        // Default: generate next 12 months as candidate pool
        const twelveMonthsLater = new Date(today);
        twelveMonthsLater.setMonth(today.getMonth() + 12);

        const current = new Date(today);
        while (current <= twelveMonthsLater) {
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          finalCandidateDates.push(`${year}-${month}-${day}`);
          current.setDate(current.getDate() + 1);
        }

        console.log(`Generated ${finalCandidateDates.length} candidate dates for next 12 months`);
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
