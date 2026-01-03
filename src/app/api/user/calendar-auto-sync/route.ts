import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireSettingsPermission } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        autoCalendarSyncEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      autoCalendarSyncEnabled: user.autoCalendarSyncEnabled,
    });
  } catch (error) {
    console.error("Error fetching auto-sync setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSettingsPermission();
    const body = await request.json();

    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid request: enabled must be a boolean" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        autoCalendarSyncEnabled: enabled,
      },
      select: {
        autoCalendarSyncEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      autoCalendarSyncEnabled: user.autoCalendarSyncEnabled,
    });
  } catch (error) {
    console.error("Error updating auto-sync setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
