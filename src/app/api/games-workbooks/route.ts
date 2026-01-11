import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

// GET all workbooks for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workbooks = await prisma.gamesWorkbook.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        sortOrder: "asc",
      },
      include: {
        _count: {
          select: {
            games: true,
          },
        },
      },
    });

    return NextResponse.json({ data: workbooks });
  } catch (error) {
    console.error("Error fetching games workbooks:", error);
    return NextResponse.json({ error: "Failed to fetch workbooks" }, { status: 500 });
  }
}

// POST - create a new workbook
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Get current max sort order for this user
    const maxSortOrderResult = await prisma.gamesWorkbook.aggregate({
      where: {
        userId: session.user.id,
      },
      _max: {
        sortOrder: true,
      },
    });

    const newSortOrder = (maxSortOrderResult._max.sortOrder ?? -1) + 1;

    const workbook = await prisma.gamesWorkbook.create({
      data: {
        name,
        sortOrder: newSortOrder,
        userId: session.user.id,
      },
    });

    trackEvent("Games Workbook Created", {
      userId: session.user.id,
      workbookId: workbook.id,
      workbookName: name,
    });

    return NextResponse.json({ data: workbook }, { status: 201 });
  } catch (error) {
    console.error("Error creating games workbook:", error);
    return NextResponse.json({ error: "Failed to create workbook" }, { status: 500 });
  }
}
