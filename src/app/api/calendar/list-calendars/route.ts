import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { google } from "googleapis";
import { prisma } from "@/lib/database/prisma";
import { hasScopes } from "@/lib/services/incremental-auth.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Check both Account (incremental auth) and User (legacy) tokens
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "google",
        },
        select: {
          id: true,
          refresh_token: true,
          access_token: true,
          expires_at: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
          calendarTokenExpiry: true,
        },
      }),
    ]);

    // Prefer Account tokens (from incremental auth), fallback to User tokens (legacy)
    const refreshToken = account?.refresh_token ?? userTokens?.googleCalendarRefreshToken ?? undefined;
    let accessToken = account?.access_token ?? userTokens?.googleCalendarAccessToken ?? undefined;
    const expiryMillis = account?.expires_at ? account.expires_at * 1000 : userTokens?.calendarTokenExpiry?.getTime();

    if (!refreshToken && !accessToken) {
      return NextResponse.json(
        { error: "Google Calendar not connected. Please connect your calendar in settings." },
        { status: 400 }
      );
    }

    // Best-effort scope check: users can have legacy tokens without Account.scope populated.
    // In that case we still try the request; if Google returns 403, we instruct them to reconnect.
    const hasCalendarScopes = await hasScopes(session.user.id, "CALENDAR");
    if (!hasCalendarScopes) {
      console.warn("[Calendar] User is missing CALENDAR scopes in Account record; attempting calendarList.list with available tokens");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + "/api/auth/callback/google"
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Refresh token if expired or missing
    const tokenExpired = expiryMillis !== undefined && expiryMillis < Date.now() - 60 * 1000;
    if ((tokenExpired || !accessToken) && refreshToken) {
      console.log("[Calendar] Refreshing expired access token");
      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token!;
      
      // Update tokens in database
      if (account) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: accessToken,
            expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : account.expires_at,
          },
        });
      }
      if (userTokens) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            googleCalendarAccessToken: accessToken,
            calendarTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });
      }
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // List all calendars the user has access to
    const response = await calendar.calendarList.list();

    const calendars = response.data.items?.map((cal) => ({
      id: cal.id,
      name: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
    })) || [];

    return NextResponse.json({ calendars });
  } catch (error: any) {
    console.error("Error listing calendars:", error);
    
    // ✅ ENHANCED: Return specific error messages for common issues
    if (error?.code === 403 || error?.status === 403) {
      return NextResponse.json(
        { error: "Insufficient permissions. Please reconnect your Google Calendar with the required scopes." },
        { status: 403 }
      );
    }
    
    if (error?.code === 401 || error?.status === 401) {
      return NextResponse.json(
        { error: "Authentication failed. Please reconnect your Google Calendar." },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to list calendars" },
      { status: 500 }
    );
  }
}
