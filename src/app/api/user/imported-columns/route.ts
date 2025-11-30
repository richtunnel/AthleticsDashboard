import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

const ERROR_RESPONSE = (message: string, status: number = 400) =>
  NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );

export async function GET() {
  try {
    const session = await requireAuth();

    // Fetch table preferences for "games" table
    const preference = await prisma.tablePreference.findUnique({
      where: {
        userId_tableKey: {
          userId: session.user.id,
          tableKey: "games",
        },
      },
    });

    // Extract imported column names from preferences
    const preferences = preference?.preferences as any;
    const customColumns = preferences?.customColumns as string[] | undefined;
    const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;

    // Filter out skipped columns and return only imported column names
    const importedColumns = customColumns && columnMapping
      ? customColumns.filter((colName) => {
          const mapping = columnMapping[colName];
          return mapping && mapping !== "skip";
        })
      : [];

    return NextResponse.json({
      success: true,
      data: importedColumns,
    });
  } catch (error) {
    console.error("Failed to fetch imported columns", error);
    return ERROR_RESPONSE("Failed to fetch imported columns", 500);
  }
}
