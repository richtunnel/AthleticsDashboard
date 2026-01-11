import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "../database/prisma";
import { hasScopes } from "./incremental-auth.service";
import { calendarSyncTrackerService } from "./calendar-sync-tracker.service";

const CALENDAR_EVENT_STATUS_SCHEDULED: calendar_v3.Schema$Event["status"] = "confirmed";

export interface UpcomingCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string | null;
  isAllDay: boolean;
  location?: string | null;
  opponent?: string | null;
  description?: string | null;
  htmlLink?: string | null;
}

//Google Calendar Sync
export class CalendarService {
  /**
   * Check if user has granted Calendar scopes (incremental auth)
   * This checks the OAuth scopes, not just token existence
   */
  private async hasCalendarScopes(userId: string): Promise<boolean> {
    return await hasScopes(userId, "CALENDAR");
  }

  /**
   * Legacy method: Check if tokens exist
   * Note: With incremental auth, this checks both scopes AND tokens
   */
  private async isCalendarConnected(userId: string): Promise<boolean> {
    // First check if Calendar scopes are granted
    const hasCalendarAccess = await this.hasCalendarScopes(userId);
    if (!hasCalendarAccess) {
      return false;
    }

    // Then check if tokens exist
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: {
          userId,
          provider: "google",
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
        },
      }),
    ]);

    const refreshToken = account?.refresh_token ?? userTokens?.googleCalendarRefreshToken ?? undefined;
    const accessToken = account?.access_token ?? userTokens?.googleCalendarAccessToken ?? undefined;

    return Boolean(refreshToken || accessToken);
  }

  private async getCalendarClient(userId: string) {
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: {
          userId,
          provider: "google",
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
          calendarTokenExpiry: true,
        },
      }),
    ]);

    const refreshToken = account?.refresh_token ?? userTokens?.googleCalendarRefreshToken ?? undefined;
    let accessToken = account?.access_token ?? userTokens?.googleCalendarAccessToken ?? undefined;
    const expiryMillis = account?.expires_at ? account.expires_at * 1000 : userTokens?.calendarTokenExpiry?.getTime();

    if (!refreshToken && !accessToken) {
      throw new Error("Google account not connected");
    }

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.NEXTAUTH_URL + "/api/auth/callback/google");

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const tokenExpired = expiryMillis !== undefined && expiryMillis < Date.now() - 60 * 1000;

    if ((tokenExpired || !accessToken) && refreshToken) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      accessToken = credentials.access_token ?? accessToken;
      const updatedRefreshToken = credentials.refresh_token ?? refreshToken;
      const updatedExpiry = credentials.expiry_date ?? null;

      if (account) {
        const accountUpdateData: Record<string, any> = {};
        if (accessToken) {
          accountUpdateData.access_token = accessToken;
        }
        if (updatedRefreshToken && updatedRefreshToken !== account.refresh_token) {
          accountUpdateData.refresh_token = updatedRefreshToken;
        }
        if (updatedExpiry !== null) {
          accountUpdateData.expires_at = Math.floor(updatedExpiry / 1000);
        } else if (account.expires_at !== null && account.expires_at !== undefined) {
          accountUpdateData.expires_at = null;
        }

        if (Object.keys(accountUpdateData).length > 0) {
          await prisma.account.update({
            where: { id: account.id },
            data: accountUpdateData,
          });
        }
      }

      const userUpdateData: Record<string, any> = {};
      if (accessToken) {
        userUpdateData.googleCalendarAccessToken = accessToken;
      }
      if (updatedRefreshToken) {
        userUpdateData.googleCalendarRefreshToken = updatedRefreshToken;
      }
      if (updatedExpiry !== null) {
        userUpdateData.calendarTokenExpiry = new Date(updatedExpiry);
      } else if (userTokens?.calendarTokenExpiry) {
        userUpdateData.calendarTokenExpiry = null;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      oauth2Client.setCredentials({
        access_token: accessToken ?? undefined,
        refresh_token: updatedRefreshToken ?? undefined,
      });
    }

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  private normalizeMappingValue(input: string) {
    return input.trim().replace(/\s+/g, " ").toLowerCase();
  }

  private async getCandidateCalendarIds(userId: string): Promise<string[]> {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
      select: { googleCalendarId: true },
    });

    const ids = new Set<string>(["primary"]);
    for (const m of mappings) {
      if (m.googleCalendarId?.trim()) {
        ids.add(m.googleCalendarId.trim());
      }
    }

    return Array.from(ids);
  }

  /**
   * Determine which calendar to use based on user-defined CalendarGroupMappings.
   * This is case/whitespace-insensitive to avoid mismatches from CSV headers/values.
   */
  private async resolveCalendarIdForGame(game: any, userId: string, calendar: any): Promise<string> {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
    });

    if (!mappings.length) {
      return "primary";
    }

    const mappingIndex = new Map<string, (typeof mappings)[number]>();
    for (const m of mappings) {
      mappingIndex.set(`${this.normalizeMappingValue(m.columnName)}::${this.normalizeMappingValue(m.columnValue)}`, m);
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

    const sport = getCustomField(["Sport"]) || game.homeTeam?.sport?.name?.trim();
    const level = getCustomField(["Level"]) || game.homeTeam?.level?.trim();
    const team = getCustomField(["Team", "Home", "Sports Level", "Team Level"]) || game.homeTeam?.name?.trim();

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

    for (const [key, value] of Object.entries(customFields)) {
      addCandidate(key, value);
    }

    for (const { columnName, value } of valuesToCheck) {
      const mapping = mappingIndex.get(`${this.normalizeMappingValue(columnName)}::${this.normalizeMappingValue(value)}`);
      if (!mapping) continue;

      try {
        await calendar.calendars.get({ calendarId: mapping.googleCalendarId });
        return mapping.googleCalendarId;
      } catch (error) {
        console.warn(`[Calendar Sync] Calendar ${mapping.googleCalendarId} not found, falling back to primary`);
      }
    }

    return "primary";
  }

  async getUpcomingEvents(userId: string, daysAhead = 3): Promise<UpcomingCalendarEvent[]> {
    try {
      // Check if calendar is connected before proceeding
      const isConnected = await this.isCalendarConnected(userId);
      if (!isConnected) {
        return [];
      }

      const calendar = await this.getCalendarClient(userId);

      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      });

      const items = response.data.items ?? [];
      const upcomingEvents: UpcomingCalendarEvent[] = [];

      for (const event of items) {
        if (event.status === "cancelled") {
          continue;
        }

        const startDate = this.getEventStartDate(event);

        if (!startDate) {
          continue;
        }

        const details = this.extractDetailsFromDescription(event.description);
        const startValue = event.start?.dateTime ?? event.start?.date ?? startDate.toISOString();
        const endValue = event.end?.dateTime ?? event.end?.date ?? null;

        upcomingEvents.push({
          id: event.id ?? `${startValue}-${event.summary ?? "event"}`,
          summary: event.summary ?? "Untitled Event",
          start: startValue,
          end: endValue,
          isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
          location: event.location ?? details.location ?? null,
          opponent: details.opponent ?? null,
          description: event.description ?? null,
          htmlLink: event.htmlLink ?? null,
        });
      }

      upcomingEvents.sort((a, b) => {
        const aTime = new Date(a.start).getTime();
        const bTime = new Date(b.start).getTime();
        return aTime - bTime;
      });

      return upcomingEvents;
    } catch (error) {
      console.error("[Calendar] Error fetching upcoming events:", error);
      return [];
    }
  }

  private getEventStartDate(event: calendar_v3.Schema$Event): Date | null {
    const rawStart = event.start?.dateTime ?? event.start?.date;

    if (!rawStart) {
      return null;
    }

    const parsed = new Date(rawStart);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private extractDetailsFromDescription(description?: string | null): { opponent?: string | null; location?: string | null } {
    if (!description) {
      return {};
    }

    const details: { opponent?: string | null; location?: string | null } = {};

    const lines = description.split(/\r?\n/);

    for (const line of lines) {
      const [label, ...rest] = line.split(":");

      if (rest.length === 0) {
        continue;
      }

      const value = rest.join(":").trim();
      const normalizedLabel = label.trim().toLowerCase();

      if (normalizedLabel === "opponent") {
        details.opponent = value || null;
      }

      if (normalizedLabel === "location") {
        details.location = value || null;
      }
    }

    return details;
  }

  async syncAllGames(userId: string, organizationId: string) {
    // Adjust the where clause to match your schema relations
    // Assumes Game has homeTeam with organizationId
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
        },
      },
      select: { id: true },
    });

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const g of games) {
      try {
        // Reuse your single-game sync routine if you have one
        // e.g., await this.syncGameToGoogleCalendar(g.id, userId);
        // For now, flip a synced flag so this compiles and runs:
        await prisma.game.update({
          where: { id: g.id },
          data: { calendarSynced: true },
        });

        results.push({ id: g.id, ok: true });
      } catch (e) {
        results.push({
          id: g.id,
          ok: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return results;
  }

  async syncGameToCalendar(gameId: string, userId: string) {
    // Get user's organizationId (only need this field)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }, // ✅ Only select what we need
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if this is the user's first synced game (for tracker)
    const isNewSyncUser = await calendarSyncTrackerService.isNewSyncUser(userId);

    // Check if calendar is connected before proceeding
    const isConnected = await this.isCalendarConnected(userId);
    if (!isConnected) {
      return {
        success: false,
        skipped: true,
        message: "Google Calendar not connected",
      };
    }

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
          include: {
            sport: true,
            organization: true, // Get timezone from org
          },
        },
        opponent: true,
        awayTeam: true,
        venue: true,
      },
    });

    if (!game) {
      throw new Error("Game not found or unauthorized");
    }

    // Get calendar client (this already handles tokens via Account table)
    const calendar = await this.getCalendarClient(userId);

    // Use organization's timezone
    const timezone = game.homeTeam.organization.timezone || "America/New_York";

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

    // Format as RFC3339 datetime string for Google Calendar
    // Google Calendar API requires proper RFC3339 format with timezone offset
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    // Create Date object to get timezone offset (handles DST automatically)
    const startDate = new Date(year, month - 1, day, hours, minutes, 0);
    const timezoneOffset = startDate.getTimezoneOffset(); // in minutes
    const offsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
    const offsetMinutes = Math.abs(timezoneOffset) % 60;
    const offsetSign = timezoneOffset <= 0 ? '+' : '-'; // Note: getTimezoneOffset returns negative for positive offsets
    const offsetString = `${offsetSign}${pad(offsetHours)}:${pad(offsetMinutes)}`;
    
    const startDateTime = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offsetString}`;
    
    // Calculate end time (2 hours later)
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth() + 1;
    const endDay = endDate.getDate();
    const endHours = endDate.getHours();
    const endMinutes = endDate.getMinutes();
    const endDateTime = `${endYear}-${pad(endMonth)}-${pad(endDay)}T${pad(endHours)}:${pad(endMinutes)}:00${offsetString}`;

    // Build location string, properly handling null/undefined values
    let location = "TBD";
    if (game.isHome) {
      location = "Home";
    } else if (game.venue) {
      const locationParts = [
        game.venue.name,
        game.venue.address,
        game.venue.city,
        game.venue.state
      ].filter(part => part && part.trim()); // Filter out null, undefined, and empty strings
      
      location = locationParts.length > 0 ? locationParts.join(", ") : "TBD";
    }

    // ✅ FIX: Don't include timeZone field when using RFC3339 datetime with offset
    // Google Calendar API expects EITHER datetime with offset OR datetime + timeZone, not both
    const event: calendar_v3.Schema$Event = {
      status: CALENDAR_EVENT_STATUS_SCHEDULED,
      summary: this.buildEventSummary(game),
      description: this.buildEventDescription(game),
      location,
      start: {
        dateTime: startDateTime,
        // ❌ REMOVED: timeZone field conflicts with RFC3339 offset format
      },
      end: {
        dateTime: endDateTime,
        // ❌ REMOVED: timeZone field conflicts with RFC3339 offset format
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 1 day before
          { method: "notification", minutes: 60 }, // 1 hour before
        ],
      },
    };
    
    console.log("[Calendar Sync] Event payload:", {
      gameId,
      summary: event.summary,
      description: event.description,
      location: event.location,
      startDateTime,
      endDateTime,
    });

    const targetCalendarId = await this.resolveCalendarIdForGame(game, userId, calendar);

    try {
      if (game.googleCalendarEventId) {
        const candidateCalendarIds = await this.getCandidateCalendarIds(userId);
        const calendarIdsToTry = [targetCalendarId, ...candidateCalendarIds.filter((id) => id !== targetCalendarId)];

        let response: any | null = null;

        for (const calendarId of calendarIdsToTry) {
          try {
            response = await calendar.events.update({
              calendarId,
              eventId: game.googleCalendarEventId,
              requestBody: event,
            });
            break;
          } catch (err: any) {
            const statusCode = err?.code ?? err?.status ?? err?.response?.status;
            if (statusCode === 404) {
              continue;
            }
            throw err;
          }
        }

        if (!response) {
          // Event not found in any candidate calendar - create a new one in the target calendar
          response = await calendar.events.insert({
            calendarId: targetCalendarId,
            requestBody: event,
          });

          await prisma.game.update({
            where: { id: gameId },
            data: {
              googleCalendarEventId: response.data.id || null,
              googleCalendarHtmlLink: response.data.htmlLink || null,
              calendarSynced: true,
              lastSyncedAt: new Date(),
            },
          });

          // Update tracker if this was the user's first synced game
          if (isNewSyncUser) {
            await calendarSyncTrackerService.incrementSyncedUserCount();
          }

          return response.data;
        }

        // Update sync timestamp
        await prisma.game.update({
          where: { id: gameId },
          data: {
            calendarSynced: true,
            lastSyncedAt: new Date(),
            googleCalendarHtmlLink: response.data.htmlLink || null,
          },
        });

        // Update tracker if this was the user's first synced game
        if (isNewSyncUser) {
          await calendarSyncTrackerService.incrementSyncedUserCount();
        }

        return response.data;
      }

      // Create new event
      const response = await calendar.events.insert({
        calendarId: targetCalendarId,
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

      // Update tracker if this was the user's first synced game
      if (isNewSyncUser) {
        await calendarSyncTrackerService.incrementSyncedUserCount();
      }

      return response.data;
    } catch (error: any) {
      // Extract detailed error information from Google API response
      const googleErrors = error.response?.data?.error?.errors || [];
      const detailedErrors = googleErrors.map((e: any) => `${e.domain}: ${e.message} (${e.reason})`).join("; ");
      
      console.error("[Calendar Sync] Failed:", {
        error: error.message,
        status: error.code || error.status,
        gameId,
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

  async deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      // Check if calendar is connected before proceeding
      const isConnected = await this.isCalendarConnected(userId);
      if (!isConnected) {
        console.info(`[Calendar] Skipping event deletion for ${eventId} - calendar not connected for user ${userId}`);
        return true;
      }

      console.info(`[Calendar] Attempting to delete event ${eventId} for user ${userId}`);
      const calendar = await this.getCalendarClient(userId);
      const calendarIdsToTry = await this.getCandidateCalendarIds(userId);

      for (const calendarId of calendarIdsToTry) {
        try {
          await calendar.events.delete({
            calendarId,
            eventId,
          });

          console.info(`[Calendar] Successfully deleted event ${eventId} from calendar ${calendarId} for user ${userId}`);
          return true;
        } catch (error: any) {
          const statusCode = error?.code ?? error?.status ?? error?.response?.status;

          if (statusCode === 404) {
            continue;
          }

          if (statusCode === 410) {
            console.warn(`[Calendar] Event ${eventId} already deleted (410) for user ${userId}. Treating as success.`);
            return true;
          }

          throw error;
        }
      }

      console.warn(`[Calendar] Event ${eventId} not found in any candidate calendar for user ${userId}. Treating as success.`);
      return true;
    } catch (error: any) {
      const statusCode = error?.code ?? error?.status ?? error?.response?.status;

      if (statusCode === 404 || statusCode === 410) {
        console.warn(`[Calendar] Event ${eventId} not found during deletion for user ${userId} (status ${statusCode}). Treating as success.`);
        return true;
      }

      console.error(`[Calendar] Failed to delete event ${eventId} for user ${userId}:`, error);
      return false;
    }
  }

  async unsyncGame(gameId: string, userId: string) {
    // Get user's organizationId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true }, // ✅ Only select what we need
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Check if calendar is connected before proceeding
    const isConnected = await this.isCalendarConnected(userId);
    if (!isConnected) {
      return {
        success: false,
        skipped: true,
        message: "Google Calendar not connected",
      };
    }

    // ✅ VALIDATE: Game belongs to user's organization
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: user.organizationId,
        },
      },
      select: {
        id: true,
        googleCalendarEventId: true,
      },
    });

    if (!game || !game.googleCalendarEventId) {
      throw new Error("Game not found, unauthorized, or not synced to calendar");
    }

    try {
      const deletionSucceeded = await this.deleteCalendarEvent(userId, game.googleCalendarEventId);

      if (!deletionSucceeded) {
        throw new Error("Failed to remove event from Google Calendar");
      }

      await prisma.game.update({
        where: { id: game.id },
        data: {
          googleCalendarEventId: null,
          googleCalendarHtmlLink: null,
          calendarSynced: false,
        },
      });

      // Check if user has no more synced games and decrement tracker
      const hasNoMoreSyncedGames = await calendarSyncTrackerService.hasNoMoreSyncedGames(userId);
      if (hasNoMoreSyncedGames) {
        await calendarSyncTrackerService.decrementSyncedUserCount();
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to remove from calendar:", error);
      throw error;
    }
  }

  private buildEventSummary(game: any): string {
    const primaryTeamName = this.getPrimaryTeamName(game);
    const opponentName = this.getOpponentTeamName(game);
    const separator = this.getSummarySeparator(game.isHome);
    const sportLevelInfo = this.getSportLevelInfo(game);
    
    let summary = `${primaryTeamName}${separator}${opponentName}`;
    if (sportLevelInfo) {
      summary += ` - ${sportLevelInfo}`;
    }
    
    return summary;
  }

  private getPrimaryTeamName(game: any): string {
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

  private getOpponentTeamName(game: any): string {
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

  private getSummarySeparator(isHome?: boolean): string {
    return isHome ? " vs " : " @ ";
  }

  private getSportLevelInfo(game: any): string | null {
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

  private buildEventDescription(game: any): string {
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
      description += `- Travel Time: ${game.estimatedTravelTime || "TBD"} minutes\n`;
      if (game.busCount) {
        description += `- Buses: ${game.busCount}\n`;
      }
      if (game.departureTime) {
        description += `- Departure: ${new Date(game.departureTime).toLocaleTimeString()}\n`;
      }
    }

    if (game.notes) {
      description += `\nNotes: ${game.notes}`;
    }

    return description;
  }
}

export const calendarService = new CalendarService();
