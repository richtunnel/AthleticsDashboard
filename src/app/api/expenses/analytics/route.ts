import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { format, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const organizationId = session.user.organizationId;

    // Get all expenses with game dates for the organization
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
          select: {
            date: true,
            homeTeam: {
              select: {
                sport: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        game: {
          date: "asc",
        },
      },
    });

    // Group expenses by year-month
    const expensesByMonth: Record<
      string,
      {
        month: string;
        year: number;
        travelExpense: number;
        foodExpense: number;
        clothesExpense: number;
        giftsExpense: number;
        totalExpense: number;
        gameCount: number;
      }
    > = {};

    expenses.forEach((expense: any) => {
      const date = parseISO(expense.game.date);
      const monthKey = format(date, "yyyy-MM");
      const year = date.getFullYear();
      const monthName = format(date, "MMM yyyy");

      if (!expensesByMonth[monthKey]) {
        expensesByMonth[monthKey] = {
          month: monthName,
          year,
          travelExpense: 0,
          foodExpense: 0,
          clothesExpense: 0,
          giftsExpense: 0,
          totalExpense: 0,
          gameCount: 0,
        };
      }

      expensesByMonth[monthKey].travelExpense += expense.travelExpense;
      expensesByMonth[monthKey].foodExpense += expense.foodExpense;
      expensesByMonth[monthKey].clothesExpense += expense.clothesExpense;
      expensesByMonth[monthKey].giftsExpense += expense.giftsExpense;
      expensesByMonth[monthKey].totalExpense +=
        expense.travelExpense +
        expense.foodExpense +
        expense.clothesExpense +
        expense.giftsExpense;
      expensesByMonth[monthKey].gameCount += 1;
    });

    // Convert to array and sort by date
    const monthlyData = Object.values(expensesByMonth).sort((a, b) => {
      return a.year - b.year || a.month.localeCompare(b.month);
    });

    // Calculate totals
    const totals = {
      travelExpense: 0,
      foodExpense: 0,
      clothesExpense: 0,
      giftsExpense: 0,
      totalExpense: 0,
      gameCount: expenses.length,
    };

    expenses.forEach((expense: any) => {
      totals.travelExpense += expense.travelExpense;
      totals.foodExpense += expense.foodExpense;
      totals.clothesExpense += expense.clothesExpense;
      totals.giftsExpense += expense.giftsExpense;
      totals.totalExpense +=
        expense.travelExpense +
        expense.foodExpense +
        expense.clothesExpense +
        expense.giftsExpense;
    });

    // Calculate average per game
    const averagePerGame = totals.gameCount > 0 ? totals.totalExpense / totals.gameCount : 0;

    return NextResponse.json({
      success: true,
      data: {
        monthlyData,
        totals,
        averagePerGame,
      },
    });
  } catch (error) {
    console.error("Error fetching expense analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch expense analytics",
      },
      { status: 500 }
    );
  }
}
