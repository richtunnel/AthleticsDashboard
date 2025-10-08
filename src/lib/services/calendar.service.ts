import { google } from "googleapis";
import { prisma } from "../prisma";

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

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.NEXTAUTH_URL + "/api/auth/callback/google");

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

  async syncGameToCalendar(gameId: string, userId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
    });

    if (!game) {
      throw new Error("Game not found");
    }

    const calendar = await this.getCalendarClient(userId);

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
      location: game.isHome ? "Home" : game.venue ? `${game.venue.name}, ${game.venue.address || ""}, ${game.venue.city}, ${game.venue.state}` : "TBD",
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: "America/New_York", // Should use organization timezone
      },
      end: {
        dateTime: eventEnd.toISOString(),
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
      if (game.googleEventId) {
        // Update existing event
        await calendar.events.update({
          calendarId: "primary",
          eventId: game.googleEventId,
          requestBody: event,
        });
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
            googleEventId: response.data.id || null,
            calendarSynced: true,
            lastSyncedAt: new Date(),
          },
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Calendar sync failed:", error);
      throw new Error("Failed to sync to Google Calendar");
    }
  }

  async syncAllGames(userId: string, organizationId: string) {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
        date: { gte: new Date() },
        calendarSynced: false,
      },
      take: 50, // Limit to avoid rate limits
    });

    const results = [];

    for (const game of games) {
      try {
        await this.syncGameToCalendar(game.id, userId);
        results.push({ gameId: game.id, success: true });
      } catch (error) {
        results.push({
          gameId: game.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Add delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }

  async unsyncGame(gameId: string, userId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || !game.googleEventId) {
      throw new Error("Game not synced to calendar");
    }

    const calendar = await this.getCalendarClient(userId);

    try {
      await calendar.events.delete({
        calendarId: "primary",
        eventId: game.googleEventId,
      });

      await prisma.game.update({
        where: { id: gameId },
        data: {
          googleEventId: null,
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
