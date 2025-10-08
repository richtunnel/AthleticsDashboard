import { Resend } from "resend";
import { prisma } from "../prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  gameId?: string;
  sentById: string;
}

export class EmailService {
  async sendEmail(params: SendEmailParams) {
    const { to, cc = [], subject, body, gameId, sentById } = params;

    // Create email log
    const emailLog = await prisma.emailLog.create({
      data: {
        to,
        cc,
        subject,
        body,
        status: "PENDING",
        gameId: gameId || null,
        sentById,
      },
    });

    try {
      // Send email via Resend
      const result = await resend.emails.send({
        from: "Athletic Director <noreply@yourdomain.com>",
        to,
        cc,
        subject,
        html: this.buildHtmlEmail(body),
      });

      // Update log on success
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      return { success: true, emailId: result.id };
    } catch (error) {
      // Update log on failure
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      throw error;
    }
  }

  async sendGameNotification(gameId: string, recipientEmails: string[], sentById: string) {
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

    const subject = `Game Schedule: ${game.homeTeam.sport.name} - ${game.opponent?.name || "TBD"}`;

    const body = `
      <h2>Game Information</h2>
      <p><strong>Date:</strong> ${new Date(game.date).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${game.time || "TBD"}</p>
      <p><strong>Sport:</strong> ${game.homeTeam.sport.name}</p>
      <p><strong>Level:</strong> ${game.homeTeam.level}</p>
      <p><strong>Opponent:</strong> ${game.opponent?.name || "TBD"}</p>
      <p><strong>Location:</strong> ${game.isHome ? "Home" : game.venue?.name || "TBD"}</p>
      
      ${
        game.travelRequired
          ? `
        <h3>Travel Information</h3>
        <p><strong>Travel Time:</strong> ${game.estimatedTravelTime} minutes</p>
        ${game.departureTime ? `<p><strong>Departure Time:</strong> ${new Date(game.departureTime).toLocaleTimeString()}</p>` : ""}
        ${game.busCount ? `<p><strong>Buses Required:</strong> ${game.busCount}</p>` : ""}
      `
          : ""
      }
      
      ${game.notes ? `<p><strong>Notes:</strong> ${game.notes}</p>` : ""}
    `;

    return this.sendEmail({
      to: recipientEmails,
      subject,
      body,
      gameId,
      sentById,
    });
  }

  async sendBulkGameNotifications(filters: { sportId?: string; level?: string; startDate?: Date; endDate?: Date }, recipientEmails: string[], sentById: string) {
    const games = await prisma.game.findMany({
      where: {
        ...(filters.sportId && {
          homeTeam: { sportId: filters.sportId },
        }),
        ...(filters.level && {
          homeTeam: { level: filters.level },
        }),
        ...(filters.startDate && {
          date: { gte: filters.startDate },
        }),
        ...(filters.endDate && {
          date: { lte: filters.endDate },
        }),
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    const subject = `Game Schedule Update - ${games.length} Games`;

    let body = "<h2>Upcoming Games</h2><ul>";

    games.forEach((game: any) => {
      body += `
        <li>
          <strong>${new Date(game.date).toLocaleDateString()}</strong> - 
          ${game.homeTeam.sport.name} (${game.homeTeam.level}) vs 
          ${game.opponent?.name || "TBD"}
          ${game.time ? ` at ${game.time}` : ""}
        </li>
      `;
    });

    body += "</ul>";

    return this.sendEmail({
      to: recipientEmails,
      subject,
      body,
      sentById,
    });
  }

  private buildHtmlEmail(body: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            h2 {
              color: #2563eb;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
            }
            h3 {
              color: #1e40af;
              margin-top: 20px;
            }
            p {
              margin: 10px 0;
            }
            strong {
              color: #1e40af;
            }
            ul {
              list-style-type: none;
              padding: 0;
            }
            li {
              padding: 10px;
              margin: 5px 0;
              background-color: #f3f4f6;
              border-left: 3px solid #2563eb;
            }
          </style>
        </head>
        <body>
          ${body}
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This email was sent from your Athletic Director Dashboard.
          </p>
        </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
