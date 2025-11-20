import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { prisma } from '@/lib/database/prisma';
import { GameTimePatternService } from '@/lib/services/game-time-pattern.service';

/**
 * POST /api/games/detect-time-pattern
 * Detects time patterns from existing games and suggests a time for a new game
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    
    const { sport, level, date } = body;

    // Validate required fields
    if (!sport || !level) {
      return NextResponse.json(
        { error: 'Sport and level are required' },
        { status: 400 }
      );
    }

    // Check if user has AI Scheduler enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { aiSchedulerEnabled: true },
    });

    if (!user?.aiSchedulerEnabled) {
      return NextResponse.json(
        { error: 'AI Scheduler is not enabled for this user' },
        { status: 403 }
      );
    }

    // Fetch games for the same sport and level
    const games = await prisma.game.findMany({
      where: {
        createdById: session.user.id,
        homeTeam: {
          sport: {
            name: sport,
          },
          level: level,
        },
        time: {
          not: null,
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
        date: 'desc',
      },
      take: 50, // Analyze last 50 games
    });

    // Detect pattern
    const pattern = GameTimePatternService.detectTimePattern(games, date);

    return NextResponse.json({
      success: true,
      pattern,
    });
  } catch (error) {
    console.error('Error detecting time pattern:', error);
    return NextResponse.json(
      { error: 'Failed to detect time pattern' },
      { status: 500 }
    );
  }
}
