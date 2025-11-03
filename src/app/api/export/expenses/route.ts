import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const organizationId = session.user.organizationId;

    // Get all expenses with full game details
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
          date: "asc",
        },
      },
    });

    // Generate CSV
    const headers = [
      "Date",
      "Sport",
      "Team",
      "Level",
      "Opponent",
      "Venue",
      "Location",
      "Travel Expense",
      "Food Expense",
      "Clothes Expense",
      "Gifts Expense",
      "Total Expense",
      "Notes",
    ];

    const rows = expenses.map((expense: any) => {
      const game = expense.game;
      const totalExpense =
        expense.travelExpense +
        expense.foodExpense +
        expense.clothesExpense +
        expense.giftsExpense;

      return [
        format(parseISO(game.date), "yyyy-MM-dd"),
        game.homeTeam.sport.name,
        game.homeTeam.name,
        game.homeTeam.level,
        game.opponent?.name || "",
        game.venue?.name || "",
        game.location || "",
        expense.travelExpense.toFixed(2),
        expense.foodExpense.toFixed(2),
        expense.clothesExpense.toFixed(2),
        expense.giftsExpense.toFixed(2),
        totalExpense.toFixed(2),
        expense.notes || "",
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(",")),
    ].join("\n");

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses_export_${format(new Date(), "yyyy-MM-dd")}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting expenses:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export expenses",
      },
      { status: 500 }
    );
  }
}
