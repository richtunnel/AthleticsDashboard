import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { revokeScopes } from "@/lib/services/incremental-auth.service";

/**
 * POST /api/auth/google-calendar/disconnect
 * 
 * Disconnects Google Calendar by revoking calendar scopes
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Revoke Calendar scopes
    const success = await revokeScopes(session.user.id, "CALENDAR");
    
    if (!success) {
      return NextResponse.json(
        { error: "Failed to disconnect calendar" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Google Calendar disconnected successfully",
    });
  } catch (error) {
    console.error("[API] Error disconnecting calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
