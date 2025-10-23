import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/utils/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const includeAdded = searchParams.get("includeAdded") === "true";

    const recommendations = await prisma.travelRecommendation.findMany({
      where: {
        game: {
          homeTeam: {
            organizationId: session.user.organizationId,
          },
        },
        ...(includeAdded
          ? {}
          : {
              addedToGame: false,
            }),
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
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error("Error fetching travel recommendations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recommendations",
      },
      { status: 500 }
    );
  }
}
