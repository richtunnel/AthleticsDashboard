import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { createGoogleOAuth2Client } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const rawState = searchParams.get("state");

  if (error) {
    console.error("Calendar OAuth error:", error);
    return NextResponse.redirect(new URL(`/dashboard/gsync?error=${encodeURIComponent(error)}`, process.env.NEXTAUTH_URL!));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/gsync?error=no_code", process.env.NEXTAUTH_URL!));
  }

  try {
    // Prefer main AD session; fall back to parent session
    let session = await getServerSession(authOptions);
    if (!session?.user) {
      session = await getParentSession();
    }

    if (!session?.user) {
      console.error("❌ No active session - user must be logged in");
      return NextResponse.redirect(new URL("/login?error=must_be_logged_in", process.env.NEXTAUTH_URL));
    }

    console.log("📅 Connecting calendar for user:", session.user.email);

    let returnTo: string | null = null;

    if (!rawState) {
      console.error("❌ No state provided in callback");
      return NextResponse.redirect(new URL("/dashboard/gsync?error=missing_state", process.env.NEXTAUTH_URL));
    }

    try {
      const decoded = Buffer.from(rawState, "base64url").toString("utf8");
      const parsed = JSON.parse(decoded);

      // Must have at least a CSRF token field
      if (!parsed || typeof parsed.token !== "string") {
        console.error("❌ Invalid state format");
        return NextResponse.redirect(new URL("/dashboard/gsync?error=invalid_state", process.env.NEXTAUTH_URL));
      }

      // If userId is present in state, verify it matches the session.
      // Incremental-auth flows may omit userId (session is the source of truth).
      if (typeof parsed.userId === "string" && parsed.userId !== (session.user as any).id) {
        console.error("❌ User ID mismatch in state");
        return NextResponse.redirect(new URL("/dashboard/gsync?error=invalid_state", process.env.NEXTAUTH_URL));
      }

      // Verify CSRF token against user.resetToken
      const dbUser = await prisma.user.findUnique({
        where: { id: (session.user as any).id },
        select: { resetToken: true, resetTokenExpiry: true },
      });

      if (
        !dbUser?.resetToken || 
        dbUser.resetToken !== parsed.token || 
        !dbUser.resetTokenExpiry || 
        dbUser.resetTokenExpiry < new Date()
      ) {
        console.error("❌ Invalid or expired state token");
        return NextResponse.redirect(new URL("/dashboard/gsync?error=invalid_state", process.env.NEXTAUTH_URL));
      }

      // Consume the token
      await prisma.user.update({
        where: { id: (session.user as any).id },
        data: { resetToken: null, resetTokenExpiry: null },
      });

      if (typeof parsed.returnTo === "string") returnTo = parsed.returnTo;
    } catch (e) {
      console.error("❌ Error parsing state:", e);
      return NextResponse.redirect(new URL("/dashboard/gsync?error=invalid_state", process.env.NEXTAUTH_URL));
    }

    // Exchange authorization code for tokens
    const oauth2Client = createGoogleOAuth2Client();

    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? session.user.googleCalendarRefreshToken ?? undefined,
    });

    console.log("✅ Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    let connectedEmail = session.user.googleCalendarEmail ?? null;
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const profile = await oauth2.userinfo.get();
      if (profile.data.email) {
        connectedEmail = profile.data.email;
      }
    } catch (profileError) {
      console.error("⚠️ Failed to fetch Google account email:", profileError);
    }

    const updateData: Record<string, any> = {};

    if (tokens.refresh_token) {
      updateData.googleCalendarRefreshToken = tokens.refresh_token;
    }

    if (tokens.access_token) {
      updateData.googleCalendarAccessToken = tokens.access_token;
    }

    if (typeof tokens.expiry_date === "number") {
      updateData.calendarTokenExpiry = new Date(tokens.expiry_date);
    }

    const emailToPersist = connectedEmail ?? session.user.googleCalendarEmail ?? session.user.email ?? null;
    if (emailToPersist) {
      updateData.googleCalendarEmail = emailToPersist;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: updateData,
      });
    }

    // Keep the Account record (used by incremental-auth and list-calendars) fully in
    // sync with the newly issued tokens.
    //
    // Scope source: prefer tokens.scope; fall back to the URL's `scope` query param
    // because Google sometimes omits tokens.scope in the JSON response when the
    // scopes are the same as the authorization request.
    const rawScopeString =
      tokens.scope ||
      searchParams.get("scope") ||
      "";
    const tokenScopes = rawScopeString.split(/[\s,]+/).filter(Boolean);

    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        id: true,
        scope: true,
        refresh_token: true,
      },
    });

    if (account) {
      const existingScopes = account.scope?.split(" ").filter(Boolean) ?? [];
      const mergedScopes = Array.from(
        new Set([...existingScopes, ...tokenScopes])
      );

      const accountUpdate: Record<string, unknown> = {
        scope: mergedScopes.join(" "),
      };

      // Restore access_token — cleared by /api/user/calendar-disconnect
      if (tokens.access_token) {
        accountUpdate.access_token = tokens.access_token;
      }

      // Restore refresh_token — only present when Google issues a new one
      // (e.g. after prompt:consent).  Keep the existing one if not provided.
      if (tokens.refresh_token) {
        accountUpdate.refresh_token = tokens.refresh_token;
      }

      if (typeof tokens.expiry_date === "number") {
        accountUpdate.expires_at = Math.floor(tokens.expiry_date / 1000);
      }

      await prisma.account.update({
        where: { id: account.id },
        data: accountUpdate,
      });
    }

    console.log("✅ Calendar connected to user:", session.user.email);

    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;
    const redirectPath = safeReturnTo || "/dashboard/gsync?calendar=connected";

    return NextResponse.redirect(new URL(redirectPath, process.env.NEXTAUTH_URL!));
  } catch (error) {
    console.error("❌ Calendar OAuth error:", error);

    return NextResponse.redirect(new URL("/dashboard/gsync?error=calendar_connection_failed", process.env.NEXTAUTH_URL));
  }
}
