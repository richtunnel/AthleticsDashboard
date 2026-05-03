import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await context.params;

    const log = await prisma.emailLog.findFirst({
      where: {
        id,
        sentById: session.user.id,
      },
      include: {
        sentBy: {
          select: {
            name: true,
            email: true,
          },
        },
        game: {
          select: {
            id: true,
            date: true,
            time: true,
            status: true,
            isHome: true,
            homeTeam: {
              select: {
                name: true,
                level: true,
                sport: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            opponent: {
              select: {
                id: true,
                name: true,
              },
            },
            venue: {
              select: {
                name: true,
              },
            },
            notes: true,
          },
        },
      },
    });

    if (!log) {
      return ApiResponse.error("Email log not found", 404);
    }

    // If gameIds are stored, fetch all games
    let games: any[] = [];
    if (log.gameIds && log.gameIds.length > 0) {
      games = await prisma.game.findMany({
        where: {
          id: { in: log.gameIds },
        },
        include: {
          homeTeam: {
            include: {
              sport: true,
            },
          },
          opponent: true,
          venue: true,
        },
      });
    }

    return ApiResponse.success({ log, games });
  } catch (error) {
    return await handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await context.params;

    const log = await prisma.emailLog.findFirst({
      where: {
        id,
        sentById: session.user.id,
      },
    });

    if (!log) {
      return ApiResponse.error("Email log not found", 404);
    }

    await prisma.emailLog.deleteMany({
      where: {
        id,
        createdAt: log.createdAt,
        sentById: session.user.id,
      },
    });

    return ApiResponse.success({ message: "Email log deleted successfully" });
  } catch (error) {
    return await handleApiError(error);
  }
}
