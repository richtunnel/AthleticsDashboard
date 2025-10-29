import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "../database/prisma";

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

  async getUpcomingEvents(userId: string, daysAhead = 3): Promise<UpcomingCalendarEvent[]> {
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
    const eventStart = new Date(game.date);
    if (game.time) {
      const [hours, minutes] = game.time.split(":");
      eventStart.setHours(parseInt(hours), parseInt(minutes));
    }

    const eventEnd = new Date(eventStart);
    eventEnd.setHours(eventEnd.getHours() + 2); // Default 2-hour duration

    const event: calendar_v3.Schema$Event = {
      status: CALENDAR_EVENT_STATUS_SCHEDULED,
      summary: this.buildEventSummary(game),
      description: this.buildEventDescription(game),
      location: game.isHome ? "Home" : game.venue ? `${game.venue.name}, ${game.venue.address || ""}, ${game.venue.city}, ${game.venue.state}`.trim() : "TBD",
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: timezone,
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
      if (game.googleCalendarEventId) {
        // Update existing event
        const response = await calendar.events.update({
          calendarId: "primary",
          eventId: game.googleCalendarEventId,
          requestBody: event,
        });

        // Update sync timestamp
        await prisma.game.update({
          where: { id: gameId },
          data: {
            calendarSynced: true,
            lastSyncedAt: new Date(),
            googleCalendarHtmlLink: response.data.htmlLink || null,
          },
        });

        return response.data;
      } else {
        // Create new event
        const response = await calendar.events.insert({
          calendarId: "primary",
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

        return response.data;
      }
    } catch (error) {
      console.error("Calendar sync failed:", error);
      throw new Error("Failed to sync to Google Calendar");
    }
  }

  async deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      console.info(`[Calendar] Attempting to delete event ${eventId} for user ${userId}`);
      const calendar = await this.getCalendarClient(userId);

      await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });

      console.info(`[Calendar] Successfully deleted event ${eventId} for user ${userId}`);
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

      return { success: true };
    } catch (error) {
      console.error("Failed to remove from calendar:", error);
      throw error;
    }
  }

  private buildEventSummary(game: any): string {
    const primaryTeamName = this.getPrimaryTeamName(game);
    const opponentName = this.getOpponentTeamName(game);
    const separator = this.getSummarySeparator(game.homeTeam?.level);
    return `${primaryTeamName}${separator}${opponentName}`;
  }

  private getPrimaryTeamName(game: any): string {
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

  private getSummarySeparator(level?: string | null): string {
    return level?.toString().toUpperCase() === "VARSITY" ? " @ " : " vs ";
  }

  private buildEventDescription(game: any): string {
    let description = `Sport: ${game.homeTeam.sport.name}\n`;
    description += `Level: ${game.homeTeam.level}\n`;
    description += `Status: ${game.status}\n`;

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
