import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { google } from "googleapis";
import { prisma } from "@/lib/database/prisma";
import { hasScopes } from "@/lib/services/incremental-auth.service";

/**
 * GET /api/parent/calendar/list
 *
 * Lists Google Calendars for the authenticated PARENT user.
 *
 * Uses ONLY the parent session — never `getAnySession()` — so a user who is
 * simultaneously logged in as AD and parent always fetches calendars for their
 * OWN Google account, not the AD's. This prevents the bug where the AD's
 * calendar (e.g. visualembassy@gmail.com) shows up in the parent's picker.
 */
export async function GET() {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check calendar scopes using the parent's user ID only
    const hasCalendarScope = await hasScopes(session.user.id, "CALENDAR");

    // Fetch tokens — prefer Account (incremental auth), fall back to User columns
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: { userId: session.user.id, provider: "google" },
        select: { id: true, refresh_token: true, access_token: true, expires_at: true },
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

    const refreshToken =
      account?.refresh_token ?? userTokens?.googleCalendarRefreshToken ?? undefined;
    let accessToken =
      account?.access_token ?? userTokens?.googleCalendarAccessToken ?? undefined;
    const expiryMillis = account?.expires_at
      ? account.expires_at * 1000
      : userTokens?.calendarTokenExpiry?.getTime();

    if (!hasCalendarScope && !refreshToken && !accessToken) {
      return NextResponse.json(
        { calendars: [], connected: false, needsConnect: true, message: "Google Calendar not connected." }
      );
    }

    if (hasCalendarScope && !refreshToken && !accessToken) {
      // Scopes granted but no tokens stored yet — ask parent to reconnect
      return NextResponse.json(
        { error: "Calendar tokens missing. Please reconnect your Google Calendar.", needsReconnect: true },
        { status: 403 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + "/api/auth/callback/google"
    );

    oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

    // Refresh if expired
    const tokenExpired =
      expiryMillis !== undefined && expiryMillis < Date.now() - 60_000;
    if ((tokenExpired || !accessToken) && refreshToken) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token!;
      if (account) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: accessToken,
            expires_at: credentials.expiry_date
              ? Math.floor(credentials.expiry_date / 1000)
              : account.expires_at,
          },
        });
      }
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const response = await calendar.calendarList.list();

    // accessRole distinguishes the parent's own calendars from calendars
    // shared with them (e.g. an AD calendar they subscribed to). Surfaced
    // so the UI can avoid showing a "you own this" treatment for shared ones.
    const calendars =
      response.data.items?.map((cal) => ({
        id: cal.id,
        name: cal.summary,
        description: cal.description,
        primary: cal.primary || false,
        accessRole: cal.accessRole || null,
        backgroundColor: cal.backgroundColor,
      })) || [];

    return NextResponse.json({
      calendars,
      grantEmail: session.user?.email ?? null,
    });
  } catch (error: any) {
    console.error("[parent/calendar/list] error:", error);
    if (error?.code === 401 || error?.status === 401) {
      return NextResponse.json(
        { error: "Authentication failed. Please reconnect your Google Calendar.", needsReconnect: true },
        { status: 401 }
      );
    }
    if (error?.code === 403 || error?.status === 403) {
      return NextResponse.json(
        { error: "Insufficient permissions. Please reconnect your Google Calendar.", needsReconnect: true },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Failed to list calendars" }, { status: 500 });
  }
}
