import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "../database/prisma";

const CALENDAR_EVENT_STATUS_SCHEDULED: calendar_v3.Schema$Event["status"] = "confirmed";

/**
 * Determines which Google Calendar to sync to based on calendar group mappings.
 * Returns the calendar ID to use, defaulting to "primary" if no match found.
 */
async function resolveCalendarId(game: any, userId: string, calendar: any): Promise<string> {
  try {
    // Check if user has any calendar group mappings
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
    });

    if (!mappings || mappings.length === 0) {
      return "primary"; // No mappings configured, use primary calendar
    }

    // Build a list of values to check from the game
    const valuesToCheck: { columnName: string; value: string }[] = [];

    // Check team name (e.g., "Junior Varsity Basketball")
    if (game.homeTeam?.name) {
      valuesToCheck.push({ columnName: "Team", value: game.homeTeam.name });
      valuesToCheck.push({ columnName: "Sports Level", value: game.homeTeam.name });
      valuesToCheck.push({ columnName: "Team Level", value: game.homeTeam.name });
    }

    // Check sport + level combination
    if (game.homeTeam?.sport?.name && game.homeTeam?.level) {
      const sportLevel = `${game.homeTeam.sport.name} ${game.homeTeam.level}`;
      valuesToCheck.push({ columnName: "Sport & Level", value: sportLevel });
      valuesToCheck.push({ columnName: "Sports Level", value: sportLevel });
    }

    // Check sport alone
    if (game.homeTeam?.sport?.name) {
      valuesToCheck.push({ columnName: "Sport", value: game.homeTeam.sport.name });
    }

    // Check level alone
    if (game.homeTeam?.level) {
      valuesToCheck.push({ columnName: "Level", value: game.homeTeam.level });
      valuesToCheck.push({ columnName: "Team Level", value: game.homeTeam.level });
    }

    // Check custom fields from imported CSV columns
    if (game.customFields && typeof game.customFields === "object") {
      Object.entries(game.customFields).forEach(([key, value]) => {
        if (value && typeof value === "string") {
          valuesToCheck.push({ columnName: key, value: value as string });
        }
      });
    }

    // Try to find a matching mapping
    for (const { columnName, value } of valuesToCheck) {
      const mapping = mappings.find((m) => m.columnName === columnName && m.columnValue === value);
      if (mapping) {
        console.log(`[Calendar Sync] Matched mapping: ${columnName} = ${value} → ${mapping.googleCalendarName}`);

        // Verify the calendar still exists in user's Google Calendar
        try {
          await calendar.calendars.get({ calendarId: mapping.googleCalendarId });
          return mapping.googleCalendarId;
        } catch (error) {
          console.warn(`[Calendar Sync] Calendar ${mapping.googleCalendarId} not found, falling back to primary`);
          continue;
        }
      }
    }

    console.log("[Calendar Sync] No matching calendar group found, using primary calendar");
    return "primary";
  } catch (error) {
    console.error("[Calendar Sync] Error resolving calendar ID:", error);
    return "primary"; // Fail gracefully, use primary calendar
  }
}

export async function syncGameToCalendar(gameId: string, userId: string) {
  // 1. Fetch user & game (Logic is correct)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, googleCalendarRefreshToken: true },
  });

  if (!user?.googleCalendarRefreshToken) return { success: false, skipped: true, message: "Google Calendar not connected" };

  const game = await prisma.game.findFirst({
    where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
    include: { homeTeam: { include: { sport: true } }, opponent: true, awayTeam: true, venue: true },
  });

  if (!game) throw new Error("Game not found");

  // 2. Auth setup
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: user.googleCalendarRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // 3. DATE CONSTRUCTION
  const isoDateOnly = game.date instanceof Date ? game.date.toISOString().split("T")[0] : String(game.date).split("T")[0];

  let hours = 12,
    minutes = 0;
  if (game.time && typeof game.time === "string") {
    const [h, m] = game.time.split(":").map(Number);
    if (!isNaN(h)) {
      hours = h;
      minutes = m || 0;
    }
  }

  // We construct the date object.
  // IMPORTANT: Ensure your server environment variable TZ is set to the user's local timezone
  // or use a timezone-aware library if this is a multi-timezone app.
  const startDate = new Date(`${isoDateOnly}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const toRFC3339 = (date: Date) => {
    const offset = -date.getTimezoneOffset();
    const absOffset = Math.abs(offset);
    const z = (n: number) => String(n).padStart(2, "0");
    const sign = offset >= 0 ? "+" : "-";
    const offsetStr = `${sign}${z(Math.floor(absOffset / 60))}:${z(absOffset % 60)}`;
    return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}:${z(date.getSeconds())}${offsetStr}`;
  };

  // 4. PAYLOAD
  const event: calendar_v3.Schema$Event = {
    summary: sanitize(buildEventSummary(game)),
    description: sanitize(buildEventDescription(game)),
    location: sanitize(formatLocation(game)),
    start: { dateTime: toRFC3339(startDate) },
    end: { dateTime: toRFC3339(endDate) },
    status: "confirmed",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 1440 },
        { method: "popup", minutes: 60 },
      ],
    },
  };

  // 5. THE SYNC (The try/catch logic you wrote is excellent)
  try {
    const calendarId = await resolveCalendarId(game, userId, calendar);
    let response;

    if (game.googleCalendarEventId) {
      try {
        response = await calendar.events.update({
          calendarId,
          eventId: game.googleCalendarEventId,
          requestBody: event,
        });
      } catch (err: any) {
        if (err.code === 404) {
          response = await calendar.events.insert({ calendarId, requestBody: event });
        } else throw err;
      }
    } else {
      response = await calendar.events.insert({ calendarId, requestBody: event });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        googleCalendarEventId: response.data.id,
        googleCalendarHtmlLink: response.data.htmlLink,
        calendarSynced: true,
        lastSyncedAt: new Date(),
      },
    });

    return { success: true, id: response.data.id, htmlLink: response.data.htmlLink };
  } catch (error: any) {
    console.error("[Calendar Sync] Error details:", error.response?.data || error.message);
    throw error;
  }
}

function buildEventSummary(game: any): string {
  const primaryTeamName = getPrimaryTeamName(game);
  const opponentName = getOpponentTeamName(game);
  const separator = getSummarySeparator(game.isHome);
  return `${primaryTeamName}${separator}${opponentName}`;
}

function getPrimaryTeamName(game: any): string {
  // Check custom fields first - try multiple common column names
  const customFields = (game.customFields as Record<string, any>) || {};
  
  // Try to build a descriptive name from Sport + Level if available
  const sport = customFields["Sport"]?.trim();
  const level = customFields["Level"]?.trim();
  
  if (sport && level) {
    // Format: "Boys Varsity Basketball" or "B V Basketball"
    return `${sport} ${level}`;
  }
  
  if (sport) {
    return sport;
  }
  
  // Check various team column names
  const teamVariations = ["Team", "Home", "Sports Level", "Team Level"];
  for (const variation of teamVariations) {
    const value = customFields[variation]?.trim();
    if (value) {
      return value;
    }
  }

  // Fall back to default columns
  const teamName = game.homeTeam?.name?.trim();
  if (teamName) {
    return teamName;
  }
  const sportName = game.homeTeam?.sport?.name?.trim();
  if (sportName) {
    return sportName;
  }
  return "TBD";
}

function getOpponentTeamName(game: any): string {
  // Check custom fields first - try "Away" column
  const customFields = (game.customFields as Record<string, any>) || {};
  const awayTeam = customFields["Away"]?.trim();
  if (awayTeam) {
    return awayTeam;
  }
  
  // Fall back to opponent/awayTeam relations
  const opponentName = game.opponent?.name?.trim();
  if (opponentName) {
    return opponentName;
  }
  const awayTeamName = game.awayTeam?.name?.trim();
  if (awayTeamName) {
    return awayTeamName;
  }
  return "TBD";
}

function getSummarySeparator(isHome?: boolean): string {
  return isHome ? " vs " : " @ ";
}

function buildEventDescription(game: any): string {
  // Helper to get value from custom fields or default columns
  const customFields = (game.customFields as Record<string, any>) || {};

  // Check custom fields first, fall back to default columns
  const sport = customFields["Sport"] || game.homeTeam?.sport?.name || "TBD";
  const level = customFields["Level"] || game.homeTeam?.level || "TBD";
  const team = customFields["Team"] || game.homeTeam?.name || "TBD";
  const status = customFields["Status"] || game.status || "TBD";

  let description = `Sport: ${sport}\n`;
  description += `Level: ${level}\n`;
  description += `Team: ${team}\n`;
  description += `Status: ${status}\n`;

  if (game.opponent) {
    description += `Opponent: ${game.opponent.name}\n`;
  }

  if (game.travelRequired) {
    description += `\nTravel Information:\n`;
    description += `- Travel Required: Yes\n`;
    if (game.estimatedTravelTime) {
      description += `- Travel Time: ${game.estimatedTravelTime} minutes\n`;
    }
    if (game.busCount) {
      description += `- Buses: ${game.busCount}\n`;
    }
    if (game.departureTime) {
      description += `- Departure: ${new Date(game.departureTime).toLocaleTimeString()}\n`;
    }
    if (game.travelCost) {
      description += `- Travel Cost: ${game.travelCost}\n`;
    }
  }

  if (game.notes) {
    description += `\nNotes: ${game.notes}`;
  }

  return description;
}

// Helper to clean up location logic
function formatLocation(game: any): string {
  if (game.isHome) return "Home Field";
  if (!game.venue) return "TBD";
  return [game.venue.name, game.venue.address, game.venue.city, game.venue.state].filter(Boolean).join(", ");
}

function sanitize(str: string | null | undefined): string {
  return (str || "").trim().replace(/[\x00-\x1F\x7F]/g, "");
}

export async function unsyncGameFromCalendar(gameId: string, userId: string) {
  // Fetch user & game
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, googleCalendarRefreshToken: true },
  });

  if (!user?.googleCalendarRefreshToken) {
    throw new Error("Google Calendar not connected");
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
    select: { id: true, googleCalendarEventId: true },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.googleCalendarEventId) {
    throw new Error("Game is not synced to calendar");
  }

  // Auth setup
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: user.googleCalendarRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    // Delete the event from Google Calendar
    await calendar.events.delete({
      calendarId: "primary",
      eventId: game.googleCalendarEventId,
    });

    // Update game in database
    await prisma.game.update({
      where: { id: gameId },
      data: {
        googleCalendarEventId: null,
        googleCalendarHtmlLink: null,
        calendarSynced: false,
        lastSyncedAt: null,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Calendar Unsync] Error:", error.response?.data || error.message);
    throw error;
  }
}
