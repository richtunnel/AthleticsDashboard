import { getResendClientOptional } from "../resend";
import { prisma } from "../database/prisma";

interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  gameId?: string;
  sentById?: string; // Make optional for system emails
}

type SubscriptionEmailType = "confirmation" | "cancellation" | "payment_failure" | "trial_ending";

interface SubscriptionEmailParams {
  type: SubscriptionEmailType;
  user: { id: string; email: string; name?: string | null };
  planName?: string | null;
  status?: string | null;
  currentPeriodEnd?: Date | null;
  cancellationDate?: Date | null;
  invoiceUrl?: string | null;
  dueDate?: Date | null;
  portalUrl?: string | null;
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
        sentById: sentById || null, // Allow null for system emails
      },
    });

    const resend = getResendClientOptional();
    if (!resend) {
      throw new Error("Email service not configured. Please set RESEND_API_KEY.");
    }

    try {
      // Send email via Resend
      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || "Athletic Director Hub <noreply@yourdomain.com>",
        to,
        cc,
        subject,
        html: this.buildHtmlEmail(body),
      });

      // The Resend API returns { data: { id: string } } on success or { error: ... }
      // Check if we have data property
      const emailId = result.data?.id || null;

      // Update log on success
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      return { success: true, emailId };
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

  async sendSubscriptionEmail(params: SubscriptionEmailParams) {
    const { user, type } = params;

    if (!user?.email) {
      throw new Error("Cannot send subscription email without a recipient email address.");
    }

    const { subject, body } = this.buildSubscriptionEmailTemplate(type, params);

    return this.sendEmail({
      to: [user.email],
      subject,
      body,
      sentById: user.id, // User emails still have sentById
    });
  }

  async sendWelcomeEmail(user: { id: string; email: string; name?: string | null }) {
    this.sendWelcomeEmailBackground(user).catch((error) => {
      console.error("Welcome email failed (non-critical):", error);
    });
  }

  private async sendWelcomeEmailBackground(user: { id: string; email: string; name?: string | null }) {
    if (!user?.email) {
      console.warn("Cannot send welcome email without a recipient email address.");
      return;
    }

    try {
      const existingWelcomeEmail = await prisma.emailLog.findFirst({
        where: {
          to: { has: user.email },
          subject: { contains: "Welcome to Athletic Director Hub" },
          status: "SENT",
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingWelcomeEmail) {
        console.log(`Welcome email already sent to ${user.email} on ${existingWelcomeEmail.createdAt.toISOString()}`);
        return;
      }

      const resend = getResendClientOptional();

      if (!resend) {
        console.warn(`Email service not configured. Welcome email not sent to ${user.email}. Please set RESEND_API_KEY.`);
        return;
      }

      const { subject, body } = this.buildWelcomeEmailTemplate(user);
      const html = this.buildHtmlEmail(body);

      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Athletic Director Hub <noreply@yourdomain.com>",
        to: [user.email],
        subject,
        html,
      });

      await prisma.emailLog
        .create({
          data: {
            to: [user.email],
            cc: [],
            subject,
            body: html,
            status: "SENT",
            sentAt: new Date(),
            sentById: null,
          },
        })
        .catch((err) => {
          console.error("Email log failed:", err);
        });
    } catch (error) {
      console.error("Welcome email send failed:", error);
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
    // Build the where clause step by step to avoid type conflicts
    const where: any = {};

    // Build homeTeam filter properly
    if (filters.sportId || filters.level) {
      where.homeTeam = {};

      if (filters.sportId) {
        where.homeTeam.sportId = filters.sportId;
      }

      if (filters.level) {
        where.homeTeam.level = filters.level;
      }
    }

    // Build date filter properly
    if (filters.startDate || filters.endDate) {
      where.date = {};

      if (filters.startDate) {
        where.date.gte = filters.startDate;
      }

      if (filters.endDate) {
        where.date.lte = filters.endDate;
      }
    }

    const games = await prisma.game.findMany({
      where,
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

  private buildWelcomeEmailTemplate(user: { id: string; email: string; name?: string | null }): { subject: string; body: string } {
    const greeting = `<p>${user.name ? `Hi ${user.name}` : "Hi there"},</p>`;
    
    const body = `
      ${greeting}
      <p>Welcome to <strong>Athletic Director Hub</strong>! We're excited to help you streamline your athletic program management.</p>
      
      <h3>What's Next?</h3>
      <p>Here are the key steps to get started:</p>
      <ul>
        <li><strong>Set up your teams:</strong> Add your sports teams and organize them by level and season</li>
        <li><strong>Add opponents:</strong> Build your opponent database for easy scheduling</li>
        <li><strong>Configure venues:</strong> Add your home and away locations</li>
        <li><strong>Schedule games:</strong> Start creating your game schedule with our intuitive interface</li>
        <li><strong>Enable integrations:</strong> Connect Google Calendar for seamless sync</li>
      </ul>
      
      <h3>Key Features</h3>
      <ul>
        <li>📅 Smart scheduling with conflict detection</li>
        <li>🗺️ AI-powered travel recommendations</li>
        <li>📧 Automated email notifications</li>
        <li>📊 Dashboard analytics and reporting</li>
        <li>📱 Mobile-friendly interface</li>
      </ul>
      
      <p>Need help getting started? Check out our dashboard or reply to this email with any questions.</p>
      
      <p style="margin-top: 24px;">
        <a
          href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/dashboard"
          style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
        >
          Go to Dashboard
        </a>
      </p>
      
      <p>We're here to help you make this season your best yet!</p>
      
      <p>Best regards,<br>The Athletic Director Hub Team</p>
    `;
    
    return {
      subject: "Welcome to Athletic Director Hub 🏆",
      body,
    };
  }

  private buildSubscriptionEmailTemplate(type: SubscriptionEmailType, params: SubscriptionEmailParams): { subject: string; body: string } {
    const greeting = `<p>${params.user.name ? `Hi ${params.user.name}` : "Hi there"},</p>`;
    const planBase = params.planName?.trim();
    const planLabel = planBase ? `${planBase} subscription` : "subscription";
    const planDescription = planBase ? `${planBase} subscription` : "your subscription";
    const status = params.status ?? "active";
    const portalUrl = params.portalUrl ?? this.resolvePortalUrl();
    const portalSection = this.portalCallToAction(portalUrl);
    const periodEnd = this.formatDisplayDate(params.currentPeriodEnd);
    const cancellationDate = this.formatDisplayDate(params.cancellationDate ?? params.currentPeriodEnd ?? null);
    const dueDate = this.formatDisplayDate(params.dueDate);
    const invoiceLink = params.invoiceUrl
      ? `<p><a href="${params.invoiceUrl}" style="color: #2563eb;">View latest invoice</a></p>`
      : "";

    switch (type) {
      case "confirmation": {
        const periodLine = periodEnd ? `<p><strong>Current period ends:</strong> ${periodEnd}</p>` : "";
        const body = `
          ${greeting}
          <p>Thanks for choosing Athletic Director Hub! Your ${planDescription} is now <strong>${status}</strong>.</p>
          ${periodLine}
          ${portalSection}
          <p>If you ever need assistance, reply to this email and our team will help.</p>
        `;
        return {
          subject: `Your ${planDescription} is confirmed`,
          body,
        };
      }
      case "cancellation": {
        const scheduleLine = cancellationDate
          ? `<p>Your access will remain available until <strong>${cancellationDate}</strong>.</p>`
          : "<p>Your access has been removed immediately.</p>";
        const body = `
          ${greeting}
          <p>We've processed your request to cancel your ${planDescription}.</p>
          ${scheduleLine}
          ${portalSection}
          <p>If this was a mistake, you can reactivate your subscription from the portal anytime.</p>
        `;
        return {
          subject: `Your ${planDescription} has been cancelled`,
          body,
        };
      }
      case "payment_failure": {
        const dueLine = dueDate
          ? `<p>Please update your billing details before <strong>${dueDate}</strong> to avoid any interruption.</p>`
          : "<p>Please update your billing details to avoid interruption.</p>";
        const body = `
          ${greeting}
          <p>We couldn't process your latest payment for your ${planDescription}.</p>
          ${dueLine}
          ${invoiceLink}
          ${portalSection}
          <p>If you've already updated your payment method, you can ignore this message.</p>
        `;
        return {
          subject: `Payment failed for your ${planLabel}`,
          body,
        };
      }
      case "trial_ending":
      default: {
        const trialLine = periodEnd
          ? `<p>Your trial will end on <strong>${periodEnd}</strong>.</p>`
          : "<p>Your trial is ending soon.</p>";
        const body = `
          ${greeting}
          ${trialLine}
          <p>Update your billing information now to keep uninterrupted access.</p>
          ${portalSection}
          <p>We're excited to keep working with you!</p>
        `;
        return {
          subject: `Your ${planLabel} trial is ending soon`,
          body,
        };
      }
    }
  }

  private portalCallToAction(url: string, label = "Open Billing Portal"): string {
    const safeUrl = url;
    return `
      <p style="margin-top: 24px;">
        <a
          href="${safeUrl}"
          style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
        >
          ${label}
        </a>
      </p>
      <p style="font-size: 14px; color: #4b5563;">
        You can manage billing, update payment methods, or download invoices anytime.
      </p>
    `;
  }

  private resolvePortalUrl(): string {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    return `${baseUrl.replace(/\/$/, "")}/dashboard/settings`;
  }

  private formatDisplayDate(date?: Date | null): string | null {
    if (!date) {
      return null;
    }

    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
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
