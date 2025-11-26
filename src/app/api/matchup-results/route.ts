import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    let matchupResults = await prisma.matchupResult.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        opponent: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Sort by gameDate (descending), then createdAt (descending)
    // Put results with gameDate first, then those without
    matchupResults = matchupResults.sort((a, b) => {
      if (a.gameDate && b.gameDate) {
        return new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime();
      }
      if (a.gameDate && !b.gameDate) return -1;
      if (!a.gameDate && b.gameDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return NextResponse.json({
      success: true,
      data: matchupResults,
    });
  } catch (error) {
    console.error("Error fetching matchup results:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch matchup results",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { opponentId, organizationScore, opponentScore, isWin } = body;

    if (!opponentId) {
      return NextResponse.json(
        { success: false, error: "Opponent is required" },
        { status: 400 }
      );
    }

    if (organizationScore === undefined || opponentScore === undefined) {
      return NextResponse.json(
        { success: false, error: "Scores are required" },
        { status: 400 }
      );
    }

    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: body,
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

    // Find the closest game date for this opponent
    let gameDate: Date | undefined = undefined;
    
    // Fetch all games with this opponent
    const games = await prisma.game.findMany({
      where: {
        opponentId,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
      select: {
        date: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    if (games.length > 0) {
      const now = new Date();
      
      // Find the game with the date closest to today
      let closestGame = games[0];
      let smallestDiff = Math.abs(now.getTime() - new Date(games[0].date).getTime());
      
      for (const game of games) {
        const gameDateObj = new Date(game.date);
        const diff = Math.abs(now.getTime() - gameDateObj.getTime());
        
        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestGame = game;
        }
      }
      
      gameDate = new Date(closestGame.date);
    }

    const matchupResult = await prisma.matchupResult.create({
      data: {
        opponentId,
        organizationScore: parseInt(organizationScore),
        opponentScore: parseInt(opponentScore),
        isWin: Boolean(isWin),
        gameDate,
        organizationId: session.user.organizationId,
      },
      include: {
        opponent: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: matchupResult,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating matchup result:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create matchup result",
      },
      { status: 500 }
    );
  }
}
