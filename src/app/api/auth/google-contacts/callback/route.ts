import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { handleIncrementalAuthCallback } from "@/lib/services/incremental-auth.service";

/**
 * POST /api/auth/google-contacts/callback
 *
 * Handles the OAuth callback and exchanges code for tokens for Google Contacts scopes.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const { code, state, redirectUrl } = body;

    if (!code || !state || !redirectUrl) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const result = await handleIncrementalAuthCallback(session.user.id, code, state, redirectUrl);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to complete authorization" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      scopes: result.scopes,
      message: "Google Contacts connected successfully",
    });
  } catch (error) {
    console.error("[API] Error handling contacts callback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
