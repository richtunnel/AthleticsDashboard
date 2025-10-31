import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiResponse.unauthorized();
    }

    const { id } = await context.params;

    const log = await prisma.emailLog.findUnique({
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
    let games = [];
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
    return handleApiError(error);
  }
}
