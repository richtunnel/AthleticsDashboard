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
  const dateStr = isoString.includes("T") ? isoString.split("T")[0] : isoString;
  const [year, month, day] = dateStr.split("-").map((num) => parseInt(num, 10));

  // Parse time components (HH:mm format)
  let hours = 12; // Default to noon if no time specified
  let minutes = 0;

  if (game.time && typeof game.time === "string" && game.time.trim()) {
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

  // ✅ FIX: Format as RFC3339 datetime string for Google Calendar
  // Google Calendar API accepts RFC3339 format with timezone offset
  // When using datetime with offset, DO NOT include the timeZone field
  const pad = (n: number) => n.toString().padStart(2, "0");

  // Determine if the date is in Daylight Saving Time for Central Time
  const isDST = (date: Date): boolean => {
    // DST in US: Second Sunday in March to First Sunday in November
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Before March or after November = Standard Time
    if (month < 2 || month > 10) return false;

    // April to October = Daylight Time
    if (month > 2 && month < 10) return true;

    // March and November need day-of-month check
    const dstStart = new Date(year, 2, 1); // March 1
    const dstEnd = new Date(year, 10, 1); // November 1

    // Find second Sunday in March
    const marchFirst = dstStart.getDay();
    const marchSecondSunday = marchFirst === 0 ? 8 : 15 - marchFirst;

    // Find first Sunday in November
    const novFirst = dstEnd.getDay();
    const novFirstSunday = novFirst === 0 ? 1 : 8 - novFirst;

    if (month === 2) {
      // March
      return day >= marchSecondSunday;
    }
    if (month === 10) {
      // November
      return day < novFirstSunday;
    }

    return false;
  };

  const gameDate = new Date(year, month - 1, day, hours, minutes, 0);

  // Create Date object to get timezone offset (handles DST automatically)
  // Central Time: UTC-6 (CST) or UTC-5 (CDT)
  const centralOffset = isDST(gameDate) ? -5 : -6;
  const offsetSign = centralOffset >= 0 ? "+" : "-";
  const offsetHours = Math.abs(centralOffset);
  const offsetString = `${offsetSign}${pad(offsetHours)}:00`;

  const startDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offsetString}`;

  // Calculate end time (2 hours later)
  const endHours = hours + 2;
  const endMinutes = minutes;
  let endDay = day;
  let endMonth = month;
  let endYear = year;
  let finalEndHours = endHours;

  // Handle day overflow
  if (endHours >= 24) {
    finalEndHours = endHours - 24;
    endDay += 1;

    // Handle month overflow
    const daysInMonth = new Date(endYear, endMonth, 0).getDate();
    if (endDay > daysInMonth) {
      endDay = 1;
      endMonth += 1;

      // Handle year overflow
      if (endMonth > 12) {
        endMonth = 1;
        endYear += 1;
      }
    }
  }

  const endDateTime = `${endYear}-${pad(endMonth)}-${pad(endDay)}T${pad(finalEndHours)}:${pad(endMinutes)}:00${offsetString}`;

  // Build location string, properly handling null/undefined values
  let location = "TBD";
  if (game.isHome) {
    location = "Home Field";
  } else if (game.venue) {
    const locationParts = [game.venue.name, game.venue.address, game.venue.city, game.venue.state].filter((part) => part && part.trim());
    location = locationParts.length > 0 ? locationParts.join(", ") : "TBD";
  }

  // Sanitize strings to prevent issues
  const sanitize = (str: string | null | undefined): string => {
    if (!str) return "";
    return String(str)
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, ""); // Remove control characters
  };

  const summary = sanitize(buildEventSummary(game)) || "Game";
  const description = sanitize(buildEventDescription(game)) || "";
  const loc = sanitize(location) || "";

  // Validate datetime format
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  if (!datetimeRegex.test(startDateTime) || !datetimeRegex.test(endDateTime)) {
    throw new Error(`Invalid datetime format: start=${startDateTime}, end=${endDateTime}`);
  }

  // ✅ Create minimal, clean event object
  const event: calendar_v3.Schema$Event = {
    summary: summary,
    description: description,
    location: loc,
    start: {
      dateTime: startDateTime,
      // No timeZone field when using RFC3339 with offset
    },
    end: {
      dateTime: endDateTime,
      // No timeZone field when using RFC3339 with offset
    },
  };

  // Only add optional fields if they're valid
  if (event.description && event.description.length > 0) {
    event.reminders = {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 60 }, // Changed from "notification" to "popup"
      ],
    };
  }

  console.log("[Calendar Sync] Event payload:", {
    gameId,
    summary: event.summary,
    description: event.description?.substring(0, 100) + (event.description && event.description.length > 100 ? "..." : ""),
    location: event.location,
    startDateTime,
    endDateTime,
    hasReminders: !!event.reminders,
  });

  try {
    // Resolve which calendar to sync to based on game data and user mappings
    const calendarId = await resolveCalendarId(game, userId, calendar);
    let response;

    if (game.googleCalendarEventId) {
      // Try to update existing event
      try {
        console.log(`[Calendar Sync] Attempting to update event: ${game.googleCalendarEventId}`);

        response = await calendar.events.update({
          calendarId,
          eventId: game.googleCalendarEventId,
          requestBody: event,
        });

        console.log(`[Calendar Sync] Successfully updated event: ${game.googleCalendarEventId}`);
      } catch (updateError: any) {
        console.error(`[Calendar Sync] Update failed, will delete and recreate:`, {
          error: updateError.message,
          status: updateError.code || updateError.status,
          eventId: game.googleCalendarEventId,
        });

        // If update fails, try to delete the old event first
        try {
          await calendar.events.delete({
            calendarId,
            eventId: game.googleCalendarEventId,
          });
          console.log(`[Calendar Sync] Deleted old event: ${game.googleCalendarEventId}`);
        } catch (deleteError) {
          console.log(`[Calendar Sync] Could not delete old event (may not exist): ${game.googleCalendarEventId}`);
        }

        // Create new event
        console.log(`[Calendar Sync] Creating new event after failed update`);
        response = await calendar.events.insert({
          calendarId,
          requestBody: event,
        });

        console.log(`[Calendar Sync] Successfully created new event: ${response.data.id}`);

        // Update game with new event ID
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
    } else {
      // Create new event
      console.log(`[Calendar Sync] Creating new event (no existing eventId)`);

      response = await calendar.events.insert({
        calendarId,
        requestBody: event,
      });

      console.log(`[Calendar Sync] Successfully created event: ${response.data.id}`);

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
  } catch (error: any) {
    // Extract detailed error information from Google API response
    const googleErrors = error.response?.data?.error?.errors || [];
    const detailedErrors = googleErrors.map((e: any) => `${e.domain}: ${e.message} (${e.reason})`).join("; ");

    console.error("[Calendar Sync] Failed:", {
      error: error.message,
      status: error.code || error.status,
      gameId,
      eventPayload: event, // Log the full event object for debugging
      response: error.response?.data || error.response || "No response data",
      detailedErrors: detailedErrors || "No detailed errors",
    });

    // Provide more specific error messages based on error code
    if (error.code === 400 || error.status === 400) {
      const errorMsg = detailedErrors || error.message || "Check event fields for malformed data";
      throw new Error(`Invalid event data: ${errorMsg}`);
    } else if (error.code === 401 || error.status === 401) {
      throw new Error("Google Calendar authentication failed. Please reconnect your calendar.");
    } else if (error.code === 403 || error.status === 403) {
      throw new Error("Permission denied. Please ensure calendar access is granted.");
    } else if (error.code === 404 || error.status === 404) {
      throw new Error("Calendar or event not found.");
    }

    throw new Error(`Failed to sync to Google Calendar: ${error.message || "Unknown error"}`);
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
