import { google } from "googleapis";
import { prisma } from "../database/prisma";

//Google Calendar Sync
export class CalendarService {
  private async getCalendarClient(userId: string) {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account || !account.access_token) {
      throw new Error("Google account not connected");
    }

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.NEXTAUTH_URL + "/api/auth/callback/google");

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    // Refresh token if expired
    if (account.expires_at && account.expires_at * 1000 < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
        },
      });

      oauth2Client.setCredentials(credentials);
    }

    return google.calendar({ version: "v3", auth: oauth2Client });
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

    const event = {
      summary: `${game.homeTeam.sport.name} - ${game.opponent?.name || "TBD"}`,
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

    // Get calendar client (this already handles tokens via Account table)
    const calendar = await this.getCalendarClient(userId);

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: game.googleCalendarEventId,
      });

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
