import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { getParentSession } from "@/lib/utils/parentSession";
import { hasScopes } from "@/lib/services/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    let session;
    try {
      session = await requireAuth();
    } catch {
      session = await getParentSession();
    }
    if (!session?.user?.id) {
      return NextResponse.json({ isConnected: false }, { status: 200 });
    }

    const hasCalendarScope = await hasScopes(session.user.id, "CALENDAR");

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleCalendarRefreshToken: true,
        googleCalendarAccessToken: true,
        googleCalendarEmail: true,
        email: true,
      },
    });

    const hasLegacyTokens = Boolean(userRecord?.googleCalendarRefreshToken || userRecord?.googleCalendarAccessToken);
    const connectedEmail = userRecord?.googleCalendarEmail || userRecord?.email || null;

    return NextResponse.json({ isConnected: hasCalendarScope || hasLegacyTokens, connectedEmail });
  } catch (error) {
    // If auth fails or any error occurs, assume not connected
    return NextResponse.json({ isConnected: false, error: "Authentication failed or user not found." }, { status: 200 });
  }
}
