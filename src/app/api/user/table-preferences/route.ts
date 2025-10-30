import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { Prisma } from "@prisma/client";

interface TablePreferencesPayload extends Record<string, Prisma.InputJsonValue | undefined> {
  order?: string[];
  hidden?: string[];
}

const ERROR_RESPONSE = (message: string, status: number = 400) =>
  NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const tableKey = request.nextUrl.searchParams.get("table");

    if (!tableKey) {
      return ERROR_RESPONSE("Missing table parameter", 400);
    }

    const preference = await prisma.tablePreference.findUnique({
      where: {
        userId_tableKey: {
          userId: session.user.id,
          tableKey,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: preference?.preferences ?? null,
    });
  } catch (error) {
    console.error("Failed to fetch table preferences", error);
    return ERROR_RESPONSE("Failed to fetch table preferences", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const tableKey = body?.table as string | undefined;
    const preferences = body?.preferences as TablePreferencesPayload | undefined;

    if (!tableKey) {
      return ERROR_RESPONSE("Missing table parameter", 400);
    }

    if (!preferences || typeof preferences !== "object") {
      return ERROR_RESPONSE("Invalid preferences payload", 400);
    }

    const sanitizedPreferences: Prisma.InputJsonObject = {
      ...preferences,
      order: Array.isArray(preferences.order) ? preferences.order.map(String) : [],
      hidden: Array.isArray(preferences.hidden) ? preferences.hidden.map(String) : [],
    };

    const result = await prisma.tablePreference.upsert({
      where: {
        userId_tableKey: {
          userId: session.user.id,
          tableKey,
        },
      },
      create: {
        userId: session.user.id,
        tableKey,
        preferences: sanitizedPreferences,
      },
      update: {
        preferences: sanitizedPreferences,
      },
    });

    return NextResponse.json({
      success: true,
      data: result.preferences,
    });
  } catch (error) {
    console.error("Failed to save table preferences", error);
    return ERROR_RESPONSE("Failed to save table preferences", 500);
  }
}
