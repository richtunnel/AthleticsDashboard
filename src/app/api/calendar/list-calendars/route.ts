import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { google } from "googleapis";
import { prisma } from "@/lib/database/prisma";
import { hasScopes } from "@/lib/services/incremental-auth.service";

export async function GET(request: NextRequest) {
  try {
    // AD / collaborator dashboards ONLY. The parent dashboard must call
    // /api/parent/calendar/list so its parent-cookie tokens are used.
    //
    // The old code also fell back to getParentSession() here, which caused
    // session bleed: a user logged in as both AD and parent would see the
    // AD's calendars on the parent dashboard (including secondary accounts
    // subscribed in the AD's Google Calendar UI).
    let session = await getAnySession();
    if (!session?.user?.id) {
      // Allow the parent-session fallback ONLY when no AD/collaborator cookie
      // exists at all (pure parent users hitting this endpoint directly).
      session = await getParentSession();
    }

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
        { calendars: [], connected: false, message: "Google Calendar not connected." }
      );
    }

    // Scope check: if the Account record has no calendar scope the tokens will
    // not work for calendarList.list, so we fail fast rather than making a
    // round-trip to Google that always returns 401.
    const hasCalendarScopes = await hasScopes(session.user.id, "CALENDAR");
    if (!hasCalendarScopes) {
      return NextResponse.json(
        {
          error: "Calendar access requires additional Google permissions. Please go to Calendar Sync and reconnect your Google account to grant calendar access.",
          needsReconnect: true,
        },
        { status: 403 }
      );
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

    // accessRole from Google's calendarList.list():
    //   "owner"           — user owns the calendar (their primary + their own secondaries)
    //   "writer"          — calendar shared with edit access (e.g. another gmail's calendar)
    //   "reader"          — read-only share
    //   "freeBusyReader"  — only sees free/busy
    // We surface this so the UI can distinguish "your calendar" from "someone
    // else's calendar you've subscribed to". The user reported confusion seeing
    // an email they don't own appearing in the list — that's almost always a
    // shared calendar with writer/reader access, not a separate OAuth grant.
    const calendars = response.data.items?.map((cal) => ({
      id: cal.id,
      name: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole || null,
      backgroundColor: cal.backgroundColor,
    })) || [];

    return NextResponse.json({
      calendars,
      // The email tied to the OAuth grant that produced this list. Lets the
      // client confirm which Google account it's actually reading from.
      grantEmail: session.user?.email ?? null,
    });
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
