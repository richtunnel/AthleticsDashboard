import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
=======
import { requireAuth } from "@/lib/utils/auth";
>>>>>>> 7cd5cc8e8ad40b63bd99766b6a77eed1f44f2ac6
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";

export async function GET(request: NextRequest) {
  try {
<<<<<<< HEAD
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiResponse.unauthorized();
    }
=======
    const session = await requireAuth();
>>>>>>> 7cd5cc8e8ad40b63bd99766b6a77eed1f44f2ac6

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const status = searchParams.get("status");

    const where: any = {
      sentById: session.user.id,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
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
              homeTeam: {
                select: {
                  name: true,
                  sport: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              opponent: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
