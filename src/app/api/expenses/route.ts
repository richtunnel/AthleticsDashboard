import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const organizationId = session.user.organizationId;
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (gameId) {
      // Get expense for a specific game
      const expense = await prisma.gameExpense.findUnique({
        where: { gameId },
        include: {
          game: {
            include: {
              homeTeam: {
                include: {
                  sport: true,
                },
              },
              opponent: true,
              venue: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: expense,
      });
    }

    // Get all expenses for the organization
    const expenses = await prisma.gameExpense.findMany({
      where: {
        game: {
          homeTeam: {
            organizationId,
          },
        },
      },
      include: {
        game: {
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
            opponent: true,
            venue: true,
          },
        },
      },
      orderBy: {
        game: {
          date: "desc",
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: expenses,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expenses",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { gameId, travelExpense, foodExpense, clothesExpense, giftsExpense, notes } = body;

    // Verify the game belongs to the user's organization
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: "Game not found or access denied",
        },
        { status: 404 }
      );
    }

    // Create or update the expense
    const expense = await prisma.gameExpense.upsert({
      where: { gameId },
      create: {
        gameId,
        travelExpense: travelExpense || 0,
        foodExpense: foodExpense || 0,
        clothesExpense: clothesExpense || 0,
        giftsExpense: giftsExpense || 0,
        notes,
      },
      update: {
        travelExpense: travelExpense || 0,
        foodExpense: foodExpense || 0,
        clothesExpense: clothesExpense || 0,
        giftsExpense: giftsExpense || 0,
        notes,
      },
      include: {
        game: {
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error("Error creating/updating expense:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save expense",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json(
        {
          success: false,
          error: "Game ID is required",
        },
        { status: 400 }
      );
    }

    // Verify the game belongs to the user's organization
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!game) {
      return NextResponse.json(
        {
          success: false,
          error: "Game not found or access denied",
        },
        { status: 404 }
      );
    }

    await prisma.gameExpense.delete({
      where: { gameId },
    });

    return NextResponse.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete expense",
      },
      { status: 500 }
    );
  }
}
