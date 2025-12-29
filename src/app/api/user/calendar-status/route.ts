import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { hasScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await requireAuth();

    const hasCalendarScope = await hasScopes(session.user.id, "CALENDAR");

    const userTokens = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleCalendarRefreshToken: true,
        googleCalendarAccessToken: true,
      },
    });

    const hasLegacyTokens = Boolean(userTokens?.googleCalendarRefreshToken || userTokens?.googleCalendarAccessToken);

    return NextResponse.json({ isConnected: hasCalendarScope || hasLegacyTokens });
  } catch (error) {
    // If auth fails or any error occurs, assume not connected
    return NextResponse.json({ isConnected: false, error: "Authentication failed or user not found." }, { status: 200 });
  }
}
