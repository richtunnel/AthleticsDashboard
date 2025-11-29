import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { GameStatus } from "@prisma/client";

interface RestoreGameData {
  date: string;
  time: string | null;
  homeTeamId: string;
  isHome: boolean;
  busTravel: boolean;
  actualDepartureTime: string | null;
  actualArrivalTime: string | null;
  opponentId: string | null;
  venueId: string | null;
  status: GameStatus;
  notes: string | null;
  location: string | null;
  customData: any;
  customFields?: Record<string, any>;
  sortOrder?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = (await request.json().catch(() => null)) as { games?: unknown } | null;

    if (!body?.games || !Array.isArray(body.games) || body.games.length === 0) {
      return NextResponse.json({ error: "No games provided for restoration" }, { status: 400 });
    }

    const games = body.games as RestoreGameData[];

    // Validate that all teams belong to user's organization
    const teamIds = [...new Set(games.map((g) => g.homeTeamId).filter(Boolean))];
    
    if (teamIds.length === 0) {
      return NextResponse.json({ error: "No valid teams found in restore data" }, { status: 400 });
    }

    const teams = await prisma.team.findMany({
      where: {
        id: { in: teamIds },
        organizationId: session.user.organizationId,
      },
      select: { id: true },
    });

    const validTeamIds = new Set(teams.map((t) => t.id));
    const invalidGames = games.filter((g) => !validTeamIds.has(g.homeTeamId));

    if (invalidGames.length > 0) {
      return NextResponse.json(
        { error: "Some games reference teams that don't belong to your organization" },
        { status: 403 }
      );
    }

    // Restore games by creating them
    const restoredGames = await Promise.all(
      games.map((gameData) =>
        prisma.game.create({
          data: {
            date: new Date(gameData.date),
            time: gameData.time,
            homeTeamId: gameData.homeTeamId,
            isHome: gameData.isHome,
            busTravel: gameData.busTravel,
            actualDepartureTime: gameData.actualDepartureTime ? new Date(gameData.actualDepartureTime) : null,
            actualArrivalTime: gameData.actualArrivalTime ? new Date(gameData.actualArrivalTime) : null,
            opponentId: gameData.opponentId,
            venueId: gameData.venueId,
            status: gameData.status,
            notes: gameData.notes,
            location: gameData.location,
            customData: gameData.customData || {},
            customFields: gameData.customFields || {},
            sortOrder: gameData.sortOrder ?? 0,
            createdById: session.user.id,
          },
        })
      )
    );

    console.info(
      `[Games] Restored ${restoredGames.length} game(s) for user ${session.user.id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        restoredCount: restoredGames.length,
        restoredGameIds: restoredGames.map((g) => g.id),
      },
    });
  } catch (error) {
    console.error("Error restoring games:", error);
    return NextResponse.json({ error: "Failed to restore games" }, { status: 500 });
  }
}
