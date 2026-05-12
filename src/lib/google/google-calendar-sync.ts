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
  // 1. Fetch user & game
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, googleCalendarRefreshToken: true },
  });

  if (!user?.googleCalendarRefreshToken) return { success: false, skipped: true, message: "Google Calendar not connected" };

  // Fetch the organization's configured timezone (e.g. "America/New_York").
  // This is critical so that event times match the times shown on the worksheet
  // rather than being interpreted in the server's UTC timezone.
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { timezone: true },
  });
  const orgTimezone = org?.timezone || "America/New_York";

  const game = await prisma.game.findFirst({
    where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
    include: { homeTeam: { include: { sport: true } }, opponent: true, awayTeam: true, venue: true },
  });

  if (!game) throw new Error("Game not found");

  // 2. Auth setup
  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: user.googleCalendarRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // 3. DATE / TIME CONSTRUCTION
  // Extract the YYYY-MM-DD portion from the game date stored in the DB.
  const isoDateOnly = game.date instanceof Date ? game.date.toISOString().split("T")[0] : String(game.date).split("T")[0];

  // Parse game.time — stored as "HH:MM", "HH:MM:SS" (24-hr) or "H:MM AM/PM" (12-hr).
  let hours = 12;
  let minutes = 0;
  if (game.time && typeof game.time === "string") {
    const timeStr = game.time.trim();
    const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (amPmMatch) {
      // 12-hour format: "6:00 PM" → 18, "12:00 AM" → 0
      let h = parseInt(amPmMatch[1], 10);
      const m = parseInt(amPmMatch[2], 10);
      const period = amPmMatch[4].toUpperCase();
      if (period === "AM" && h === 12) h = 0;
      if (period === "PM" && h !== 12) h += 12;
      hours = h;
      minutes = m;
    } else {
      // 24-hour format: "18:00" or "18:00:00"
      const parts = timeStr.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(h)) {
        hours = h;
        minutes = isNaN(m) ? 0 : m;
      }
    }
  }

  // Build naive local datetime strings (no UTC offset).
  // We pass orgTimezone to Google Calendar via start.timeZone / end.timeZone so
  // Google interprets these times in the correct local zone — no server-side
  // Date math needed, which avoids the server-UTC-offset problem.
  const pad = (n: number) => String(n).padStart(2, "0");
  const endHours = hours + 2;
  const endDay = endHours >= 24; // crosses midnight?
  const endH = endHours % 24;

  const naiveStart = `${isoDateOnly}T${pad(hours)}:${pad(minutes)}:00`;
  let naiveEnd: string;
  if (endDay) {
    // Add one day to isoDateOnly
    const d = new Date(`${isoDateOnly}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    const nextDay = d.toISOString().split("T")[0];
    naiveEnd = `${nextDay}T${pad(endH)}:${pad(minutes)}:00`;
  } else {
    naiveEnd = `${isoDateOnly}T${pad(endH)}:${pad(minutes)}:00`;
  }

  // 4. PAYLOAD
  // description uses HTML so that line breaks render correctly in all Google
  // Calendar clients. Plain \n is treated as whitespace-collapsible in HTML
  // context and renders inline.
  const event: calendar_v3.Schema$Event = {
    summary: sanitize(buildEventSummary(game)),
    description: buildEventDescription(game), // HTML — do not run through sanitize()
    location: sanitize(formatLocation(game)),
    start: { dateTime: naiveStart, timeZone: orgTimezone },
    end: { dateTime: naiveEnd, timeZone: orgTimezone },
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

    // Surface insufficient-scope errors with a recognisable code so the
    // calling route can prompt the user to re-authorise instead of showing
    // a generic 500.
    const errData = error.response?.data?.error ?? error;
    const isInsufficientScope =
      errData?.code === 403 &&
      (errData?.status === "PERMISSION_DENIED" ||
        (errData?.message ?? "").toLowerCase().includes("insufficient"));

    if (isInsufficientScope) {
      const scopeError: any = new Error(
        "Google Calendar authorisation is missing required permissions. Please reconnect your calendar."
      );
      scopeError.code = "INSUFFICIENT_SCOPE";
      throw scopeError;
    }

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

/**
 * Builds the Google Calendar event description as HTML.
 *
 * Google Calendar's description field is rendered as HTML — plain \n characters
 * collapse as whitespace (just like in a web page). Using <div> or <br> tags
 * ensures each field appears on its own line in every Google Calendar client
 * (web, iOS, Android).
 */
function buildEventDescription(game: any): string {
  const customFields = (game.customFields as Record<string, any>) || {};

  const getField = (fieldNames: string[], defaultValue?: any): string => {
    for (const name of fieldNames) {
      if (customFields[name]) return esc(String(customFields[name]));
      const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
      if (key && customFields[key]) return esc(String(customFields[key]));
    }
    return esc(defaultValue || "TBD");
  };

  const sport  = getField(["Sport"],        game.homeTeam?.sport?.name);
  const level  = getField(["Level"],        game.homeTeam?.level);
  const team   = getField(["Team", "Home"], game.homeTeam?.name);
  const status = getField(["Status"],       game.status);

  const rows: string[] = [
    `<div><b>Sport:</b> ${sport}</div>`,
    `<div><b>Level:</b> ${level}</div>`,
    `<div><b>Team:</b> ${team}</div>`,
    `<div><b>Status:</b> ${status}</div>`,
  ];

  if (game.opponent?.name) {
    rows.push(`<div><b>Opponent:</b> ${esc(game.opponent.name)}</div>`);
  }

  if (game.travelRequired) {
    rows.push(`<div>&nbsp;</div><div><b>Travel Information</b></div>`);
    rows.push(`<div>• Travel Required: Yes</div>`);
    if (game.estimatedTravelTime) {
      rows.push(`<div>• Travel Time: ${esc(String(game.estimatedTravelTime))} minutes</div>`);
    }
    if (game.busCount) {
      rows.push(`<div>• Buses: ${esc(String(game.busCount))}</div>`);
    }
    if (game.departureTime) {
      rows.push(`<div>• Departure: ${esc(new Date(game.departureTime).toLocaleTimeString())}</div>`);
    }
    if (game.travelCost) {
      rows.push(`<div>• Travel Cost: ${esc(String(game.travelCost))}</div>`);
    }
  }

  if (game.notes) {
    rows.push(`<div>&nbsp;</div><div><b>Notes:</b> ${esc(String(game.notes))}</div>`);
  }

  return rows.join("");
}

/** HTML-escapes a plain-text string so it is safe inside HTML tags. */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Helper to clean up location logic
function formatLocation(game: any): string {
  if (game.isHome) return "Home Field";
  if (!game.venue) return "TBD";
  return [game.venue.name, game.venue.address, game.venue.city, game.venue.state].filter(Boolean).join(", ");
}

/**
 * Strips C0/C1 control characters from plain-text fields (summary, location).
 * Do NOT call this on the description — description is HTML and is handled
 * separately via buildEventDescription() + esc().
 */
function sanitize(str: string | null | undefined): string {
  return (str || "").trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
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
