import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state"); // user ID

  if (error) {
    console.error("Calendar OAuth error:", error);
    return NextResponse.redirect(new URL(`/dashboard/settings?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/settings?error=no_code", request.url));
  }

  try {
    // Get the current logged-in user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error("❌ No active session - user must be logged in");
      return NextResponse.redirect(new URL("/login?error=must_be_logged_in", request.url));
    }

    console.log("📅 Connecting calendar for user:", session.user.email);

    // Verify state matches user ID (optional security check)
    if (state && state !== session.user.id) {
      console.error("❌ State mismatch - possible CSRF attack");
      return NextResponse.redirect(new URL("/dashboard/settings?error=invalid_state", request.url));
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

    console.log("✅ Calendar connected to user:", session.user.email);

    return NextResponse.redirect(new URL("/dashboard/settings?calendar=connected", request.url));
  } catch (error) {
    console.error("❌ Calendar OAuth error:", error);

    return NextResponse.redirect(new URL("/dashboard/settings?error=calendar_connection_failed", request.url));
  }
}
