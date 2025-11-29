import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { hasScopes, getGrantedScopes } from "@/lib/services/incremental-auth.service";

/**
 * GET /api/auth/google-calendar/status
 * 
 * Checks if user has granted Google Calendar permissions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Check if user has Calendar scopes
    const hasCalendarAccess = await hasScopes(session.user.id, "CALENDAR");
    
    // Get all granted scopes (for debugging/admin purposes)
    const grantedScopes = await getGrantedScopes(session.user.id);
    
    return NextResponse.json({
      success: true,
      connected: hasCalendarAccess,
      scopes: grantedScopes,
    });
  } catch (error) {
    console.error("[API] Error checking calendar status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
