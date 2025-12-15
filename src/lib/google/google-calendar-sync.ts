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
    if (game.customFields && typeof game.customFields === 'object') {
      Object.entries(game.customFields).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          valuesToCheck.push({ columnName: key, value: value as string });
        }
      });
    }

    // Try to find a matching mapping
    for (const { columnName, value } of valuesToCheck) {
      const mapping = mappings.find(
        (m) => m.columnName === columnName && m.columnValue === value
      );
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
  // Get the user's Google account credentials
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      organizationId: true,
      googleCalendarRefreshToken: true,
      googleCalendarAccessToken: true,
      calendarTokenExpiry: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user?.googleCalendarRefreshToken) {
    return {
      success: false,
      skipped: true,
      message: "Google Calendar not connected",
    };
  }

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

  oauth2Client.setCredentials({
    refresh_token: user.googleCalendarRefreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // ✅ VALIDATE: Game belongs to user's organization
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      homeTeam: {
        organizationId: user.organizationId,
      },
    },
    include: {
      homeTeam: {
        include: { sport: true },
      },
      opponent: true,
      awayTeam: true,
      venue: true,
    },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  // Prepare event data
  // Safari-friendly date parsing: extract date components from ISO string
  // Handle both Date objects and strings
  const isoString = game.date instanceof Date ? game.date.toISOString() : game.date;
  const dateStr = isoString.includes('T') ? isoString.split('T')[0] : isoString;
  const [year, month, day] = dateStr.split('-').map(num => parseInt(num, 10));
  
  // Parse time components (HH:mm format)
  let hours = 12; // Default to noon if no time specified
  let minutes = 0;
  
  if (game.time && typeof game.time === 'string' && game.time.trim()) {
    const timeParts = game.time.trim().split(":");
    if (timeParts.length >= 2) {
      const parsedHours = parseInt(timeParts[0], 10);
      const parsedMinutes = parseInt(timeParts[1], 10);
      if (!isNaN(parsedHours) && !isNaN(parsedMinutes) && parsedHours >= 0 && parsedHours <= 23 && parsedMinutes >= 0 && parsedMinutes <= 59) {
        hours = parsedHours;
        minutes = parsedMinutes;
      }
    }
  }

  // Format as local datetime string for Google Calendar (YYYY-MM-DDTHH:mm:ss)
  // This represents the local time in the specified timezone WITHOUT UTC conversion
  const pad = (n: number) => n.toString().padStart(2, '0');
  const startDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
  
  // Calculate end time (2 hours later)
  const endHours = hours + 2;
  const endDay = endHours >= 24 ? day + 1 : day;
  const normalizedEndHours = endHours % 24;
  const endDateTime = `${year}-${pad(month)}-${pad(endDay)}T${pad(normalizedEndHours)}:${pad(minutes)}:00`;

  const event: calendar_v3.Schema$Event = {
    status: CALENDAR_EVENT_STATUS_SCHEDULED,
    summary: buildEventSummary(game),
    description: buildEventDescription(game),
    location: game.isHome ? "Home Field" : game.venue ? `${game.venue.name}, ${game.venue.address || ""}, ${game.venue.city || ""}, ${game.venue.state || ""}` : "TBD",
    start: {
      dateTime: startDateTime,
      timeZone: "America/New_York",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "America/New_York",
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 }, // 1 day before
        { method: "popup", minutes: 60 }, // 1 hour before
      ],
    },
  };

  try {
    // Resolve which calendar to sync to based on game data and user mappings
    const calendarId = await resolveCalendarId(game, userId, calendar);
    let response;

    if (game.googleCalendarEventId) {
      // Update existing event
      response = await calendar.events.update({
        calendarId,
        eventId: game.googleCalendarEventId,
        requestBody: event,
      });
    } else {
      // Create new event
      response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      // Update game with event ID
      await prisma.game.update({
        where: { id: gameId },
        data: {
          googleCalendarEventId: response.data.id || null,
          googleCalendarHtmlLink: response.data.htmlLink || null,
          calendarSynced: true,
          lastSyncedAt: new Date(),
        },
      });
    }

    return {
      id: response.data.id,
      htmlLink: response.data.htmlLink,
      success: true,
    };
  } catch (error) {
    console.error("Calendar sync failed:", error);
    throw new Error("Failed to sync to Google Calendar");
  }
}

function buildEventSummary(game: any): string {
  const primaryTeamName = getPrimaryTeamName(game);
  const opponentName = getOpponentTeamName(game);
  const separator = getSummarySeparator(game.isHome);
  return `${primaryTeamName}${separator}${opponentName}`;
}

function getPrimaryTeamName(game: any): string {
  // Check custom fields first
  const customFields = (game.customFields as Record<string, any>) || {};
  const customTeam = customFields["Team"]?.trim();
  if (customTeam) {
    return customTeam;
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
