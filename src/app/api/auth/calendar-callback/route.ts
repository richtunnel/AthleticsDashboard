import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

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
    // Get the current logged-in user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error("❌ No active session - user must be logged in");
      return NextResponse.redirect(new URL("/login?error=must_be_logged_in", process.env.NEXTAUTH_URL));
    }

    console.log("📅 Connecting calendar for user:", session.user.email);

    let stateUserId: string | null = rawState;
    let returnTo: string | null = null;

    if (rawState) {
      try {
        const decoded = Buffer.from(rawState, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded);

        if (parsed && typeof parsed.userId === "string") {
          stateUserId = parsed.userId;
          if (typeof parsed.returnTo === "string") {
            returnTo = parsed.returnTo;
          }
        }
      } catch {
        // Ignore parse errors and fall back to legacy state format
      }
    }

    // Verify state matches user ID (optional security check)
    if (stateUserId && stateUserId !== session.user.id) {
      console.error("❌ State mismatch - possible CSRF attack");
      return NextResponse.redirect(new URL("/dashboard/gsync?error=invalid_state", process.env.NEXTAUTH_URL));
    }

    // Exchange authorization code for tokens
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

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

    // Keep incremental-auth (Account.scope) in sync when a user connected via the
    // legacy calendar OAuth flow.
    const tokenScopes = tokens.scope?.split(" ").filter(Boolean) ?? [];
    if (tokenScopes.length > 0) {
      const account = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "google",
        },
        select: {
          id: true,
          scope: true,
        },
      });

      if (account) {
        const existingScopes = account.scope?.split(" ").filter(Boolean) ?? [];
        const mergedScopes = Array.from(new Set([...existingScopes, ...tokenScopes]));

        await prisma.account.update({
          where: { id: account.id },
          data: {
            scope: mergedScopes.join(" "),
          },
        });
      }
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
