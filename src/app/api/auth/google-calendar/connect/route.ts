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
    
    // Use the registered redirect URI — must exactly match Google Cloud Console.
    // returnTo is carried in the OAuth state parameter instead of the URI.
    const callbackUrl = process.env.GOOGLE_REDIRECT_URI || `${getSiteUrl()}/api/auth/calendar-callback`;

    // Initiate incremental auth for Calendar scopes
    const result = await initiateIncrementalAuth(
      session.user.id,
      "CALENDAR",
      callbackUrl,
      returnTo
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
