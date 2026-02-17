import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { handleIncrementalAuthCallback } from "@/lib/microsoft/incremental-auth.service";

/**
 * GET /api/auth/microsoft-calendar/callback
 *
 * Handles OAuth callback from Microsoft after user grants calendar permissions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const returnTo = searchParams.get("returnTo") || "/dashboard/microsoft-sync";

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/dashboard/microsoft-sync?error=missing_params`, request.url)
      );
    }

    // Construct callback URL for token exchange
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const callbackUrl = `${baseUrl}/api/auth/microsoft-calendar/callback`;

    // Handle the OAuth callback
    const result = await handleIncrementalAuthCallback(
      session.user.id,
      code,
      state,
      callbackUrl
    );

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/dashboard/microsoft-sync?error=${encodeURIComponent(result.error || "authorization_failed")}`, request.url)
      );
    }

    // Redirect to returnTo URL with success
    return NextResponse.redirect(
      new URL(`${returnTo}?success=true`, request.url)
    );
  } catch (error) {
    console.error("[API] Error handling Microsoft calendar callback:", error);
    return NextResponse.redirect(
      new URL(`/dashboard/microsoft-sync?error=internal_error`, request.url)
    );
  }
}
