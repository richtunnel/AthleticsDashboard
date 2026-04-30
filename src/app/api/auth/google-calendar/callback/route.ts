import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { handleIncrementalAuthCallback } from "@/lib/services/incremental-auth.service";

/**
 * POST /api/auth/google-calendar/callback
 * 
 * Handles the OAuth callback and exchanges code for tokens
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get callback parameters
    const body = await request.json();
    const { code, state, redirectUrl } = body;
    
    if (!code || !state || !redirectUrl) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }
    
    // Handle the callback and update account
    const result = await handleIncrementalAuthCallback(
      (session.user as any).id,
      code,
      state,
      redirectUrl
    );
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to complete authorization" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      scopes: result.scopes,
      message: "Google Calendar connected successfully",
    });
  } catch (error) {
    console.error("[API] Error handling calendar callback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
