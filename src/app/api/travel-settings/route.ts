import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/utils/auth";

export async function GET() {
  try {
    const session = await requireAuth();

    const settings = await prisma.travelSettings.upsert({
      where: { organizationId: session.user.organizationId },
      update: {},
      create: {
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("Error fetching travel settings:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 });
  }
}
