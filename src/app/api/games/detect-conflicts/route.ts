import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/utils/auth';
import { prisma } from '@/lib/database/prisma';
import { GameTimePatternService } from '@/lib/services/game-time-pattern.service';

/**
 * POST /api/games/detect-conflicts
 * Detects scheduling conflicts for a game
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    
    const { sport, level, date, time, excludeGameId } = body;

    // Validate required fields
    if (!sport || !level || !date) {
      return NextResponse.json(
        { error: 'Sport, level, and date are required' },
        { status: 400 }
      );
    }

    // Fetch all games for the same sport and level
    const games = await prisma.game.findMany({
      where: {
        createdById: session.user.id,
        homeTeam: {
          sport: {
            name: sport,
          },
          level: level,
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
    });

    // Detect conflicts
    const conflictInfo = GameTimePatternService.detectConflicts(
      games,
      date,
      time,
      sport,
      level,
      excludeGameId
    );

    return NextResponse.json({
      success: true,
      ...conflictInfo,
    });
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to detect conflicts' },
      { status: 500 }
    );
  }
}
