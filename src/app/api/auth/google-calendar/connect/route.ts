import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { initiateIncrementalAuth } from "@/lib/services/incremental-auth.service";
import { getSiteUrl } from "@/lib/utils/siteUrl";

/**
 * POST /api/auth/google-calendar/connect
 * 
 * Initiates incremental OAuth flow to request Google Calendar permissions
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    
    // Get redirect URL from request body (optional, defaults to callback)
    const body = await request.json().catch(() => ({}));
    const returnTo = body.returnTo || "/dashboard/gsync";
    
    // Construct callback URL — always use env-driven site URL, never request-derived
    // origin (which can leak the bind address 0.0.0.0:3000 in production behind a proxy).
    const baseUrl = getSiteUrl();
    const callbackUrl = `${baseUrl}/auth/calendar/callback?returnTo=${encodeURIComponent(returnTo)}`;
    
    // Initiate incremental auth for Calendar scopes
    const result = await initiateIncrementalAuth(
      session.user.id,
      "CALENDAR",
      callbackUrl
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to initiate authorization" },
        { status: 400 }
      );
    }
    
    // Return auth URL for frontend to redirect to
    return NextResponse.json({
      success: true,
      authUrl: result.authUrl,
    });
  } catch (error) {
    console.error("[API] Error initiating calendar connection:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
