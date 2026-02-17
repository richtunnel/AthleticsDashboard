import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { hasScopes, getGrantedScopes } from "@/lib/microsoft/incremental-auth.service";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/auth/microsoft-calendar/status
 *
 * Checks the status of Microsoft Calendar connection
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user has granted calendar scopes
    const hasCalendarScopes = await hasScopes(session.user.id, "CALENDAR");

    // Get all granted scopes
    const grantedScopes = await getGrantedScopes(session.user.id);

    // Check if tokens exist
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        microsoftCalendarRefreshToken: true,
        microsoftCalendarAccessToken: true,
        microsoftCalendarTokenExpiry: true,
      },
    });

    const isConnected = hasCalendarScopes && !!user?.microsoftCalendarRefreshToken;

    return NextResponse.json({
      connected: isConnected,
      scopes: grantedScopes,
    });
  } catch (error) {
    console.error("[API] Error checking Microsoft calendar status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
