// lib/google/calendar-sync.ts
import { google, calendar_v3 } from "googleapis";
import { prisma } from "@/lib/database/prisma";

const CALENDAR_ID = "primary"; // Use the user's primary calendar

/**
 * Creates or updates a Google Calendar event for a game.
 */
export async function syncGameToCalendar(gameId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleCalendarRefreshToken: true },
  });

  if (!user?.googleCalendarRefreshToken) {
    throw new Error("User has not connected their Google Calendar.");
  }

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

  oauth2Client.setCredentials({
    refresh_token: user.googleCalendarRefreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { homeTeam: true, opponent: true, venue: true },
  });

  if (!game) throw new Error("Game not found.");

  // Format data for Google Calendar API
  const isHome = game.isHome;
  const opponentName = game.opponent?.name || "TBD Opponent";
  const locationName = isHome ? `${game.homeTeam.name} Home Field` : game.venue?.name || "TBD Venue";
  const summary = `${isHome ? "Home" : "Away"} Game: ${game.homeTeam.name} vs ${opponentName}`;

  // Combine date and time to create start/end timestamps
  const dateStr = game.date.toISOString().split("T")[0];
  const startTime = game.time || "18:00"; // Default time if none is set
  const endTime = game.time
    ? // Assume 2-hour game duration
      new Date(new Date(`${dateStr}T${game.time}:00`).getTime() + 2 * 60 * 60 * 1000).toTimeString().split(" ")[0].substring(0, 5)
    : "20:00";

  const event: calendar_v3.Schema$Event = {
    summary: summary,
    location: locationName,
    description: `Status: ${game.status}\nNotes: ${game.notes || "N/A"}`,
    start: {
      dateTime: `${dateStr}T${startTime}:00`, // YYYY-MM-DDT18:00:00
      timeZone: "America/New_York", // Set an appropriate Time Zone
    },
    end: {
      dateTime: `${dateStr}T${endTime}:00`,
      timeZone: "America/New_York",
    },
    // Set event ID for update/delete operations if it exists
    id: game.googleCalendarEventId || undefined,
  };

  try {
    let result;

    if (game.googleCalendarEventId) {
      // Event exists, UPDATE it
      result = await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: game.googleCalendarEventId,
        requestBody: event,
      });
    } else {
      // Event does not exist, CREATE it
      result = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: event,
      });
    }

    // Update the Game record with the Google Event ID
    await prisma.game.update({
      where: { id: gameId },
      data: {
        googleCalendarEventId: result.data.id,
        googleCalendarHtmlLink: result.data.htmlLink,
      },
    });

    return result.data;
  } catch (err) {
    console.error("Calendar Sync Error:", err);
    throw new Error("Failed to sync game to Google Calendar.");
  }
}
