import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    console.error("Calendar OAuth error:", error);
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard?error=no_code", request.url));
  }

  try {
    // Get the current logged-in user session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      console.error("❌ No active session - user must be logged in");
      return NextResponse.redirect(new URL("/login?error=must_be_logged_in&redirect=/dashboard", request.url));
    }

    console.log("📅 Connecting calendar for user:", session.user.email);

    // Exchange authorization code for tokens
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

    const { tokens } = await oauth2Client.getToken(code);

    console.log("✅ Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    });

    // Find user by session ID or email
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id || undefined,
        email: session.user.email || undefined,
      },
    });

    if (!user) {
      console.error("❌ User not found in database");
      return NextResponse.redirect(new URL("/dashboard?error=user_not_found", request.url));
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleCalendarRefreshToken: tokens.refresh_token || user.googleCalendarRefreshToken, // Keep old if no new one
        googleCalendarAccessToken: tokens.access_token,
        calendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    console.log("✅ Calendar connected to existing user:", user.email);

    return NextResponse.redirect(new URL("/dashboard?calendar=connected", request.url));
  } catch (error) {
    console.error("❌ Calendar OAuth error:", error);

    return NextResponse.redirect(new URL("/dashboard?error=calendar_connection_failed", request.url));
  }
}
