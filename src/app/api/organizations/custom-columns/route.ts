import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { customColumns: true },
    });

    const customColumns = organization?.customColumns || [];

    return NextResponse.json({
      success: true,
      data: customColumns,
    });
  } catch (error) {
    console.error("Error fetching custom columns:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch custom columns",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { name, type = "text" } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Column name is required",
        },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { customColumns: true },
    });

    const currentColumns = (organization?.customColumns as any[]) || [];

    // Check max limit
    if (currentColumns.length >= 50) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum of 50 custom columns allowed",
        },
        { status: 400 }
      );
    }

    // Check for duplicate names
    if (currentColumns.some((col: any) => col.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: "A column with this name already exists",
        },
        { status: 400 }
      );
    }

    const newColumn = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      type,
      createdAt: new Date().toISOString(),
    };

    const updatedColumns = [...currentColumns, newColumn];

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { customColumns: updatedColumns },
    });

    return NextResponse.json(
      {
        success: true,
        data: newColumn,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating custom column:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create custom column",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const columnId = searchParams.get("id");

    if (!columnId) {
      return NextResponse.json(
        {
          success: false,
          error: "Column ID is required",
        },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { customColumns: true },
    });

    const currentColumns = (organization?.customColumns as any[]) || [];
    const updatedColumns = currentColumns.filter((col: any) => col.id !== columnId);

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { customColumns: updatedColumns },
    });

    // Also remove this column data from all games
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId: session.user.organizationId,
        },
      },
    });

    // Update all games to remove this custom column data
    await Promise.all(
      games.map(async (game) => {
        if (game.customData) {
          const customData = game.customData as any;
          delete customData[columnId];

          await prisma.game.update({
            where: { id: game.id },
            data: { customData },
          });
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: "Column deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting custom column:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete custom column",
      },
      { status: 500 }
    );
  }
}
