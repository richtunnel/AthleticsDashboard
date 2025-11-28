import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/user/reset-columns
 * Resets user's imported custom columns back to default columns
 * Clears customColumns, columnMapping, and importedAt from table preferences
 */
export async function POST() {
  try {
    const session = await requireAuth();

    // Fetch current table preferences
    const currentPreference = await prisma.tablePreference.findUnique({
      where: {
        userId_tableKey: {
          userId: session.user.id,
          tableKey: "games",
        },
      },
    });

    if (!currentPreference) {
      // No preferences exist, nothing to reset
      return NextResponse.json({
        success: true,
        message: "No custom columns to reset",
      });
    }

    // Remove imported column configuration while preserving other preferences
    const currentPreferences = currentPreference.preferences as any || {};
    const {
      customColumns,
      columnMapping,
      importedAt,
      ...otherPreferences
    } = currentPreferences;

    // Update preferences without imported column data
    await prisma.tablePreference.update({
      where: {
        userId_tableKey: {
          userId: session.user.id,
          tableKey: "games",
        },
      },
      data: {
        preferences: otherPreferences,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Custom columns reset successfully. Default columns restored.",
    });
  } catch (error) {
    console.error("Failed to reset custom columns", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset custom columns",
      },
      { status: 500 }
    );
  }
}
