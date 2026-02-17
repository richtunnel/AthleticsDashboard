import { prisma } from "@/lib/database/prisma";
import { makeMicrosoftApiRequest, MicrosoftCalendarEvent } from "./auth";

/**
 * Microsoft Outlook Calendar sync functionality
 */

interface GameEventData {
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location: {
    displayName: string;
  };
}

/**
 * Determines which Microsoft Calendar to sync to based on calendar group mappings.
 * Returns the calendar ID to use, defaulting to the user's primary calendar if no match found.
 */
async function resolveMicrosoftCalendarId(game: any, userId: string): Promise<string> {
  try {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
      select: {
        microsoftCalendarId: true,
        microsoftCalendarName: true,
        columnName: true,
        columnValue: true,
      },
    });

    if (!mappings || mappings.length === 0 || !mappings.some(m => m.microsoftCalendarId)) {
      return ""; // Empty string means primary calendar for Microsoft Graph API
    }

    const normalize = (input: string) => input.trim().replace(/\s+/g, " ").toLowerCase();
    const mappingIndex = new Map<string, (typeof mappings)[number]>();

    for (const m of mappings) {
      if (m.microsoftCalendarId) {
        mappingIndex.set(`${normalize(m.columnName)}::${normalize(m.columnValue)}`, m);
      }
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
      if (!mapping || !mapping.microsoftCalendarId) continue;

      console.log(`[Microsoft Calendar Sync] Matched mapping: ${columnName} = ${value} → ${mapping.microsoftCalendarName}`);

      return mapping.microsoftCalendarId;
    }

    console.log("[Microsoft Calendar Sync] No matching calendar group found, using primary calendar");
    return ""; // Empty string for primary calendar
  } catch (error) {
    console.error("[Microsoft Calendar Sync] Error resolving calendar ID:", error);
    return ""; // Empty string for primary calendar
  }
}

export async function syncGameToMicrosoftCalendar(gameId: string, userId: string) {
  // 1. Fetch user & game
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, microsoftCalendarRefreshToken: true },
  });

  if (!user?.microsoftCalendarRefreshToken) {
    return { success: false, skipped: true, message: "Microsoft Calendar not connected" };
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
    include: { homeTeam: { include: { sport: true } }, opponent: true, awayTeam: true, venue: true },
  });

  if (!game) throw new Error("Game not found");

  // 2. Get user's primary calendar (default calendar)
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { microsoftCalendarId: true },
  });

  const calendarId = userRecord?.microsoftCalendarId || "";

  // 3. Determine target calendar based on mappings
  const targetCalendarId = await resolveMicrosoftCalendarId(game, userId);

  // 4. DATE CONSTRUCTION
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

  const startDate = new Date(`${isoDateOnly}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const toISO8601 = (date: Date) => {
    return date.toISOString();
  };

  // 5. PAYLOAD
  const eventData: GameEventData = {
    subject: sanitize(buildEventSummary(game)),
    body: {
      contentType: "HTML",
      content: sanitize(buildEventDescription(game)).replace(/\n/g, "<br/>"),
    },
    start: {
      dateTime: toISO8601(startDate),
      timeZone: "UTC", // Microsoft requires a timezone, using UTC as default
    },
    end: {
      dateTime: toISO8601(endDate),
      timeZone: "UTC",
    },
    location: {
      displayName: sanitize(formatLocation(game)),
    },
  };

  // 6. THE SYNC
  try {
    let response;
    const endpoint = targetCalendarId
      ? `/me/calendars/${targetCalendarId}/events`
      : "/me/calendar/events";

    if (game.microsoftCalendarEventId) {
      // Update existing event
      const updateEndpoint = targetCalendarId
        ? `/me/calendars/${targetCalendarId}/events/${game.microsoftCalendarEventId}`
        : `/me/calendar/events/${game.microsoftCalendarEventId}`;

      try {
        response = await makeMicrosoftApiRequest<MicrosoftCalendarEvent>(userId, updateEndpoint, {
          method: "PATCH",
          body: JSON.stringify(eventData),
        });
      } catch (err: any) {
        // If event not found, create a new one
        if (err.message?.includes("404") || err.message?.includes("ResourceNotFound")) {
          response = await makeMicrosoftApiRequest<MicrosoftCalendarEvent>(userId, endpoint, {
            method: "POST",
            body: JSON.stringify(eventData),
          });
        } else {
          throw err;
        }
      }
    } else {
      // Create new event
      response = await makeMicrosoftApiRequest<MicrosoftCalendarEvent>(userId, endpoint, {
        method: "POST",
        body: JSON.stringify(eventData),
      });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        microsoftCalendarEventId: response.id,
        microsoftCalendarWebLink: response.webLink || null,
        calendarSynced: true,
        lastSyncedAt: new Date(),
      },
    });

    return { success: true, id: response.id, webLink: response.webLink };
  } catch (error: any) {
    console.error("[Microsoft Calendar Sync] Error details:", error);
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
  const customFields = (game.customFields as Record<string, any>) || {};

  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      if (customFields[name]) return customFields[name]?.trim();
      const key = Object.keys(customFields).find((k) => k.toLowerCase() === name.toLowerCase());
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
  const customFields = (game.customFields as Record<string, any>) || {};

  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      if (customFields[name]) return customFields[name]?.trim();
      const key = Object.keys(customFields).find((k) => k.toLowerCase() === name.toLowerCase());
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

  const getField = (fieldNames: string[]): string | undefined => {
    for (const name of fieldNames) {
      if (customFields[name]) return customFields[name]?.trim();
      const key = Object.keys(customFields).find((k) => k.toLowerCase() === name.toLowerCase());
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
  const customFields = (game.customFields as Record<string, any>) || {};

  const getField = (fieldNames: string[], defaultValue?: any): string => {
    for (const name of fieldNames) {
      if (customFields[name]) return customFields[name];
      const key = Object.keys(customFields).find((k) => k.toLowerCase() === name.toLowerCase());
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

function formatLocation(game: any): string {
  if (game.isHome) return "Home Field";
  if (!game.venue) return "TBD";
  return [game.venue.name, game.venue.address, game.venue.city, game.venue.state].filter(Boolean).join(", ");
}

function sanitize(str: string | null | undefined): string {
  return (str || "").trim().replace(/[\x00-\x1F\x7F]/g, "");
}

export async function unsyncGameFromMicrosoftCalendar(gameId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, microsoftCalendarRefreshToken: true },
  });

  if (!user?.microsoftCalendarRefreshToken) {
    throw new Error("Microsoft Calendar not connected");
  }

  const game = await prisma.game.findFirst({
    where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
    select: { id: true, microsoftCalendarEventId: true },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.microsoftCalendarEventId) {
    throw new Error("Game is not synced to Microsoft calendar");
  }

  try {
    // Try to delete from the primary calendar
    try {
      await makeMicrosoftApiRequest(userId, `/me/calendar/events/${game.microsoftCalendarEventId}`, {
        method: "DELETE",
      });
    } catch (err: any) {
      // If not found in primary calendar, check mappings
      if (err.message?.includes("404") || err.message?.includes("ResourceNotFound")) {
        const mappings = await prisma.calendarGroupMapping.findMany({
          where: { userId },
          select: { microsoftCalendarId: true },
        });

        for (const mapping of mappings) {
          if (!mapping.microsoftCalendarId) continue;

          try {
            await makeMicrosoftApiRequest(userId, `/me/calendars/${mapping.microsoftCalendarId}/events/${game.microsoftCalendarEventId}`, {
              method: "DELETE",
            });
            break;
          } catch (innerErr) {
            // Continue trying other calendars
            continue;
          }
        }
      } else {
        throw err;
      }
    }

    // Update game in database
    await prisma.game.update({
      where: { id: gameId },
      data: {
        microsoftCalendarEventId: null,
        microsoftCalendarWebLink: null,
        calendarSynced: false,
        lastSyncedAt: null,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[Microsoft Calendar Unsync] Error:", error);
    throw error;
  }
}
