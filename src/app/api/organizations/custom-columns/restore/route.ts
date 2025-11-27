import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { columns } = body;

    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: "No columns provided for restoration" }, { status: 400 });
    }

    // Validate all columns belong to this organization
    for (const column of columns) {
      if (column.organizationId !== session.user.organizationId) {
        return NextResponse.json({ error: "Unauthorized: Column does not belong to your organization" }, { status: 403 });
      }
    }

    // Check column limit
    const existingColumns = await prisma.customColumn.count({
      where: { organizationId: session.user.organizationId },
    });

    if (existingColumns + columns.length > 50) {
      return NextResponse.json(
        { error: `Cannot restore columns: Would exceed maximum of 50 columns (current: ${existingColumns})` },
        { status: 400 }
      );
    }

    // Restore columns and their data
    const restoredColumns = [];
    
    for (const column of columns) {
      // Recreate the custom column
      const newColumn = await prisma.customColumn.create({
        data: {
          id: column.id, // Preserve original ID for data restoration
          name: column.name,
          type: column.type,
          organizationId: column.organizationId,
          createdAt: new Date(column.createdAt),
        },
      });

      restoredColumns.push(newColumn);

      // Restore game data for this column
      if (column.gameDataBackup && Array.isArray(column.gameDataBackup)) {
        for (const backup of column.gameDataBackup) {
          try {
            const game = await prisma.game.findUnique({
              where: { id: backup.gameId },
              select: { id: true, customData: true },
            });

            if (game) {
              const currentCustomData = (game.customData as any) || {};
              const updatedCustomData = {
                ...currentCustomData,
                [column.id]: backup.data,
              };

              await prisma.game.update({
                where: { id: backup.gameId },
                data: { customData: updatedCustomData },
              });
            }
          } catch (error) {
            console.error(`Failed to restore data for game ${backup.gameId}:`, error);
            // Continue with other games even if one fails
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        restoredCount: restoredColumns.length,
        columns: restoredColumns,
      },
    });
  } catch (error) {
    console.error("Error restoring custom columns:", error);
    return NextResponse.json({ error: "Failed to restore columns" }, { status: 500 });
  }
}
