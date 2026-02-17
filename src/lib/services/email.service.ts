import { getResendClientOptional } from "../resend";
import { prisma } from "../database/prisma";
import { emailLimitService } from "./email-limit.service";
import { format } from "date-fns";

interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  gameId?: string;
  sentById?: string; // Make optional for system emails
}

type SubscriptionEmailType = "confirmation" | "cancellation" | "payment_failure" | "payment_success" | "trial_ending" | "upgrade";

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
  amount?: number;
  currency?: string;
  paidAt?: Date | null;
  previousPlan?: string | null;
}

export class EmailService {
  async sendEmail(params: SendEmailParams) {
    const { to, cc = [], subject, body, gameId, sentById } = params;

    // Check email limits if user is sending (skip for system emails)
    if (sentById) {
      const recipientCount = to.length + cc.length;
      const limitCheck = await emailLimitService.checkEmailLimits(sentById, recipientCount);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason || "Email limit exceeded");
      }
    }

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
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
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
          subject: { contains: "Welcome to Opletics" },
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
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
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
      <p><strong>Date:</strong> ${format(new Date(game.date), "dd/MM/yyyy")}</p>
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
        <strong>${format(new Date(game.date), "dd/MM/yyyy")}</strong> - 
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
      <p>Welcome to <strong>Opletics</strong>! We're excited to help you streamline your athletic program management.</p>
      
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
      
      <p>Best regards,<br>The Opletics Team</p>
    `;

    return {
      subject: "Welcome to Opletics 🏆",
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
    const invoiceLink = params.invoiceUrl ? `<p><a href="${params.invoiceUrl}" style="color: #2563eb;">View latest invoice</a></p>` : "";

    switch (type) {
      case "confirmation": {
        const periodLine = periodEnd ? `<p><strong>Current period ends:</strong> ${periodEnd}</p>` : "";
        const body = `
          ${greeting}
          <p>Thanks for choosing Opletics! Your ${planDescription} is now <strong>${status}</strong>.</p>
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
        const scheduleLine = cancellationDate ? `<p>Your access will remain available until <strong>${cancellationDate}</strong>.</p>` : "<p>Your access has been removed immediately.</p>";
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
      case "payment_success": {
        const amount = params.amount ? (params.amount / 100).toFixed(2) : null;
        const currency = params.currency?.toUpperCase() || "USD";
        const paidDate = this.formatDisplayDate(params.paidAt);
        const amountLine = amount ? `<p><strong>Amount paid:</strong> ${currency} ${amount}</p>` : "";
        const dateLine = paidDate ? `<p><strong>Payment date:</strong> ${paidDate}</p>` : "";

        const body = `
          ${greeting}
          <p>Thank you! Your payment for your ${planDescription} has been successfully processed.</p>
          ${amountLine}
          ${dateLine}
          ${invoiceLink}
          ${portalSection}
          <p>Your subscription is active and all features are available.</p>
          <p>Thank you for choosing Opletics!</p>
        `;
        return {
          subject: `Payment received - ${planLabel}`,
          body,
        };
      }
      case "upgrade": {
        const previousPlan = params.previousPlan || "Free";
        const newPlan = params.planName || "paid plan";
        const body = `
          ${greeting}
          <p>🎉 Congratulations! You've successfully upgraded from the <strong>${previousPlan}</strong> plan to the <strong>${newPlan}</strong>.</p>
          
          <h3>What's New?</h3>
          <ul>
            <li>✨ AI-powered email generation</li>
            <li>🔍 Advanced schedule conflict detection</li>
            <li>🗓️ Game date discovery tools</li>
            <li>🚌 Automated bus scheduling</li>
            <li>📧 50,000+ batch email sends</li>
            <li>💬 Priority chat and email support</li>
          </ul>
          
          <p>All premium features are now active on your account. Start exploring them from your dashboard!</p>
          
          ${portalSection}
          
          <p>Thank you for upgrading! We're excited to help you take your athletic program management to the next level.</p>
        `;
        return {
          subject: `Welcome to ${newPlan} - You're all set!`,
          body,
        };
      }
      case "trial_ending":
      default: {
        const trialLine = periodEnd ? `<p>Your trial will end on <strong>${periodEnd}</strong>.</p>` : "<p>Your trial is ending soon.</p>";
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

  async sendSupportNotificationEmail(params: { type: "feedback" | "ticket"; submitter: { name: string; email: string }; subject: string; message: string; ticketNumber?: string }): Promise<void> {
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Email service not configured. Support notification not sent.");
      return;
    }

    const { type, submitter, subject, message, ticketNumber } = params;
    const typeLabel = type === "feedback" ? "Feedback" : "Support Ticket";
    const ticketInfo = ticketNumber ? ` (${ticketNumber})` : "";

    const body = `
      <h2>New ${typeLabel} Submission${ticketInfo}</h2>
      <p><strong>From:</strong> ${submitter.name} (${submitter.email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <h3>Message:</h3>
      <div style="background-color: #f3f4f6; padding: 15px; border-left: 3px solid #2563eb;">
        ${message.replace(/\n/g, "<br>")}
      </div>
      <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
        Submitted at: ${new Date().toLocaleString()}
      </p>
    `;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
        to: ["support@opletics.com"],
        subject: `New ${typeLabel}: ${subject}`,
        html: this.buildHtmlEmail(body),
      });
      console.log("Support notification email sent successfully");
    } catch (error) {
      console.error("Failed to send support notification email:", error);
      // Don't throw - this is a non-critical feature
    }
  }

  async sendTicketConfirmationEmail(params: { userEmail: string; userName: string; ticketNumber: string; subject: string }): Promise<void> {
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Email service not configured. Ticket confirmation email not sent.");
      return;
    }

    const { userEmail, userName, ticketNumber, subject } = params;
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const ticketUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/support/${ticketNumber}`;

    const body = `
      <h2>Support Ticket Confirmation</h2>
      <p>Hi ${userName},</p>
      <p>Thank you for contacting us. We have received your support request and are working on resolving your issue.</p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${ticketNumber}</p>
        <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
      </div>

      <p>We will respond to your inquiry within <strong>48 hours</strong>.</p>
      
      <p style="margin-top: 24px;">
        <a
          href="${ticketUrl}"
          style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
        >
          View Your Ticket
        </a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        You can track the status of your ticket and view our response in your dashboard at any time.
      </p>
    `;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
        to: [userEmail],
        subject: `Support Ticket ${ticketNumber} - We're on it!`,
        html: this.buildHtmlEmail(body),
      });
      console.log(`Ticket confirmation email sent to ${userEmail}`);
    } catch (error) {
      console.error("Failed to send ticket confirmation email:", error);
      // Don't throw - this is a non-critical feature
    }
  }

  async sendCollaborationInviteEmail(params: { to: string; inviterName: string; role: "VIEWER" | "MEMBER"; acceptUrl: string; expiresAt: Date }): Promise<void> {
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Email service not configured. Collaboration invitation email not sent.");
      return;
    }

    const { to, inviterName, role, acceptUrl, expiresAt } = params;
    
    const roleDescription = role === "VIEWER" ? "Viewer (Read-Only)" : "Member (Full Access)";
    const expiresAtFormatted = expiresAt.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const body = `
      <h2>You've been invited to collaborate!</h2>
      <p>Hi,</p>
      <p><strong>${inviterName}</strong> has invited you to collaborate on their Opletics dashboard.</p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Role:</strong> ${roleDescription}</p>
        <p style="margin: 5px 0;"><strong>Access Level:</strong> ${role === "VIEWER" ? "View dashboard and reports (read-only)" : "Edit games, teams, and data (full access)"}</p>
        <p style="margin: 5px 0;"><strong>Invitation Expires:</strong> ${expiresAtFormatted}</p>
      </div>

      <h3>What does this mean?</h3>
      <ul>
        <li>${role === "VIEWER" ? "• View all dashboard pages and game schedules" : "• View and edit all dashboard features including games, teams, and schedules"}</li>
        <li>${role === "VIEWER" ? "• Cannot make changes to settings or invite other collaborators" : "• Can help manage games, teams, and scheduling"}</li>
        <li>• Access is granted only to the specific dashboard that invited you</li>
        <li>• You keep your own separate account - this doesn't merge accounts</li>
      </ul>

      <p style="margin-top: 24px;">
        <a
          href="${acceptUrl}"
          style="display: inline-block; padding: 12px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px;"
        >
          Accept Invitation
        </a>
      </p>

      <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
        This invitation expires in 24 hours. After that, you'll need to request a new invitation from the account owner.
      </p>
    `;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
        to: [to],
        subject: `Invitation to collaborate on Opletics dashboard`,
        html: this.buildHtmlEmail(body),
      });
      console.log(`Collaboration invitation email sent to ${to}`);
    } catch (error) {
      console.error("Failed to send collaboration invitation email:", error);
      // Don't throw - this is a non-critical feature
    }
  }

  async sendTicketClosedNotification(params: { ticketNumber: string; subject: string; closedBy: { name: string; email: string } }): Promise<void> {
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Email service not configured. Ticket closed notification not sent.");
      return;
    }

    const { ticketNumber, subject, closedBy } = params;

    const body = `
      <h2>Support Ticket Closed by User</h2>
      <p>A support ticket has been closed by the user.</p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Ticket Number:</strong> ${ticketNumber}</p>
        <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
        <p style="margin: 5px 0;"><strong>Closed By:</strong> ${closedBy.name} (${closedBy.email})</p>
      </div>

      <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">
        Closed at: ${new Date().toLocaleString()}
      </p>
    `;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "Opletics <noreply@opletics.com>",
        to: ["support@opletics.com"],
        subject: `Ticket ${ticketNumber} Closed by User`,
        html: this.buildHtmlEmail(body),
      });
      console.log("Ticket closed notification email sent to support team");
    } catch (error) {
      console.error("Failed to send ticket closed notification email:", error);
      // Don't throw - this is a non-critical feature
    }
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
            This email was sent from your Opletics.
          </p>
        </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
