import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "../database/prisma";
import { createGoogleOAuth2Client } from "./auth";

const CALENDAR_EVENT_STATUS_SCHEDULED: calendar_v3.Schema$Event["status"] = "confirmed";

/**
 * Determines which Google Calendar to sync to based on calendar group mappings.
 * Returns the calendar ID to use, defaulting to "primary" if no match found.
 */
async function resolveCalendarId(game: any, userId: string, calendar: any): Promise<string> {
  try {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
    });

    if (!mappings || mappings.length === 0) {
      return "primary";
    }

    const normalize = (input: string) => input.trim().replace(/\s+/g, " ").toLowerCase();
    const mappingIndex = new Map<string, (typeof mappings)[number]>();

    for (const m of mappings) {
      mappingIndex.set(`${normalize(m.columnName)}::${normalize(m.columnValue)}`, m);
    }

    const valuesToCheck: { columnName: string; value: string }[] = [];

    const addCandidate = (columnName: string, rawValue: unknown) => {
      if (typeof rawValue !== "string") return;
      const value = rawValue.trim();
      if (!value) return;
      valuesToCheck.push({ columnName, value });
    };

    const customFields: Record<string, unknown> =
      game.customFields && typeof game.customFields === "object" && !Array.isArray(game.customFields)
        ? (game.customFields as Record<string, unknown>)
        : {};

    const getCustomField = (fieldNames: string[]): string | undefined => {
      const keys = Object.keys(customFields);
      for (const name of fieldNames) {
        const exact = customFields[name];
        if (typeof exact === "string" && exact.trim()) return exact.trim();

        const foundKey = keys.find((k) => k.toLowerCase() === name.toLowerCase());
        const value = foundKey ? customFields[foundKey] : undefined;
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };

    // Prefer custom fields for sport/level/team (CSV imports), but fall back to core fields.
    const sport = getCustomField(["Sport"]) || game.homeTeam?.sport?.name?.trim();
    const level = getCustomField(["Level"]) || game.homeTeam?.level?.trim();

    // Team name can come from many CSV headers; check common ones case-insensitively.
    const team =
      getCustomField(["Team", "Home", "Sports Level", "Team Level"]) ||
      game.homeTeam?.name?.trim();

    if (team) {
      addCandidate("Team", team);
      addCandidate("Sports Level", team);
      addCandidate("Team Level", team);
    }

    if (sport && level) {
      const sportLevel = `${sport} ${level}`.trim();
      addCandidate("Sport & Level", sportLevel);
      addCandidate("Sports Level", sportLevel);
    }

    if (sport) {
      addCandidate("Sport", sport);
    }

    if (level) {
      addCandidate("Level", level);
      addCandidate("Team Level", level);
    }

    // Add every custom field value as a candidate (exact column name from CSV header).
    for (const [key, value] of Object.entries(customFields)) {
      addCandidate(key, value);
    }

    for (const { columnName, value } of valuesToCheck) {
      const mapping = mappingIndex.get(`${normalize(columnName)}::${normalize(value)}`);
      if (!mapping) continue;

      console.log(`[Calendar Sync] Matched mapping: ${columnName} = ${value} → ${mapping.googleCalendarName}`);

      try {
        await calendar.calendars.get({ calendarId: mapping.googleCalendarId });
        return mapping.googleCalendarId;
      } catch (error) {
        console.warn(`[Calendar Sync] Calendar ${mapping.googleCalendarId} not found, falling back to primary`);
      }
    }

    console.log("[Calendar Sync] No matching calendar group found, using primary calendar");
    return "primary";
  } catch (error) {
    console.error("[Calendar Sync] Error resolving calendar ID:", error);
    return "primary";
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
  const oauth2Client = createGoogleOAuth2Client();
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
  const sportLevelInfo = getSportLevelInfo(game);
  
  let summary = `${primaryTeamName}${separator}${opponentName}`;
  if (sportLevelInfo) {
    summary += ` - ${sportLevelInfo}`;
  }
  
  return summary;
}

function getPrimaryTeamName(game: any): string {
  // Check custom fields first - try multiple common column names
  const customFields = (game.customFields as Record<string, any>) || {};

  // Helper function for case-insensitive field lookup
  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      // Try exact match first
      if (customFields[name]) return customFields[name]?.trim();
      // Try case-insensitive match
      const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && customFields[key]) return customFields[key]?.trim();
    }
    return undefined;
  };

  // PRIORITY 1: Check for explicit Home column first (highest priority)
  const homeTeam = getField(["Home"]);
  if (homeTeam) {
    return homeTeam;
  }

  // PRIORITY 2: Check for Team column (second priority)
  const teamValue = getField(["Team"]);
  if (teamValue) {
    return teamValue;
  }

  // PRIORITY 3: Try to build a descriptive name from Sport + Level if available
  const sport = getField(["Sport"]);
  const level = getField(["Level"]);

  if (sport && level) {
    // Format: "Boys Varsity Basketball" or "B V Basketball"
    return `${sport} ${level}`;
  }

  if (sport) {
    return sport;
  }

  // PRIORITY 4: Check other common team column names
  const teamLevelValue = getField(["Sports Level", "Team Level"]);
  if (teamLevelValue) {
    return teamLevelValue;
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
  // Check custom fields first - try multiple common column names for opponent/away team
  const customFields = (game.customFields as Record<string, any>) || {};

  // Helper function for case-insensitive field lookup
  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      // Try exact match first
      if (customFields[name]) return customFields[name]?.trim();
      // Try case-insensitive match
      const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && customFields[key]) return customFields[key]?.trim();
    }
    return undefined;
  };

  // PRIORITY 1: Check for explicit Away column first (highest priority)
  const awayTeam = getField(["Away"]);
  if (awayTeam) {
    return awayTeam;
  }

  // PRIORITY 2: Check for Opponent column
  const opponent = getField(["Opponent"]);
  if (opponent) {
    return opponent;
  }

  // PRIORITY 3: Check for other common opponent column names
  const otherOpponent = getField(["Enemy", "Visiting Team", "Visitor"]);
  if (otherOpponent) {
    return otherOpponent;
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

function getSportLevelInfo(game: any): string | null {
  const customFields = (game.customFields as Record<string, any>) || {};

  // Helper function for case-insensitive field lookup
  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      // Try exact match first
      if (customFields[name]) return customFields[name]?.trim();
      // Try case-insensitive match
      const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && customFields[key]) return customFields[key]?.trim();
    }
    return undefined;
  };

  // Check for combined sport/level columns first
  const sportLevel = getField(["Sport Level", "Sport/Level", "Sports Level", "Team Level"]);
  if (sportLevel) {
    return sportLevel;
  }

  // Check for tier information
  const tier = getField(["Tier", "Tiers"]);
  if (tier) {
    return tier;
  }

  // Try to build from separate Sport + Level columns
  const sport = getField(["Sport"]);
  const level = getField(["Level"]);

  if (sport && level) {
    return `${sport} ${level}`;
  }

  if (sport) {
    return sport;
  }

  if (level) {
    return level;
  }

  // Fall back to database fields if custom fields don't exist
  const dbSport = game.homeTeam?.sport?.name?.trim();
  const dbLevel = game.homeTeam?.level?.trim();

  if (dbSport && dbLevel) {
    return `${dbSport} ${dbLevel}`;
  }

  if (dbSport) {
    return dbSport;
  }

  if (dbLevel) {
    return dbLevel;
  }

  return null;
}

function buildEventDescription(game: any): string {
  // Helper to get value from custom fields or default columns
  const customFields = (game.customFields as Record<string, any>) || {};

  // Helper function for case-insensitive field lookup
  const getField = (fieldNames: string[], defaultValue?: any): string => {
    for (const name of fieldNames) {
      // Try exact match first
      if (customFields[name]) return customFields[name];
      // Try case-insensitive match
      const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && customFields[key]) return customFields[key];
    }
    return defaultValue || "TBD";
  };

  // Check custom fields first (case-insensitive), fall back to default columns
  const sport = getField(["Sport"], game.homeTeam?.sport?.name);
  const level = getField(["Level"], game.homeTeam?.level);
  const team = getField(["Team", "Home"], game.homeTeam?.name);
  const status = getField(["Status"], game.status);

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
  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: user.googleCalendarRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
      select: { googleCalendarId: true },
    });

    const calendarIdsToTry = Array.from(
      new Set([
        "primary",
        ...mappings
          .map((m) => m.googleCalendarId)
          .filter((id): id is string => Boolean(id && id.trim())),
      ])
    );

    let deleted = false;

    for (const calendarId of calendarIdsToTry) {
      try {
        await calendar.events.delete({
          calendarId,
          eventId: game.googleCalendarEventId,
        });
        deleted = true;
        break;
      } catch (err: any) {
        const statusCode = err?.code ?? err?.status ?? err?.response?.status;
        if (statusCode === 404) {
          continue;
        }
        throw err;
      }
    }

    if (!deleted) {
      console.warn(`[Calendar Unsync] Event ${game.googleCalendarEventId} not found in any candidate calendar. Treating as success.`);
    }

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
