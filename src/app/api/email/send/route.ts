import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Resend } from "resend";
import { format } from "date-fns";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Game {
  id: string;
  date: Date;
  time: string | null;
  status: string;
  isHome: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent: {
    name: string;
    [key: string]: any;
  } | null;
  venue: {
    name: string;
    [key: string]: any;
  } | null;
  notes: string | null;
}

function buildScheduleEmailHTML(games: Game[], additionalMessage: string, category: string): string {
  let html = '<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">';

  // Add greeting based on category
  html += '<h2 style="color: #23252a;">Game Schedule Confirmation</h2>';

  if (additionalMessage) {
    html += `<div style="margin-bottom: 24px; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #23252a; border-radius: 4px;">`;
    html += `<p style="margin: 0; white-space: pre-wrap;">${additionalMessage}</p>`;
    html += "</div>";
  }

  // Add games table
  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">';

  // Table header
  html += "<thead>";
  html += '<tr style="background-color: #23252a; color: white;">';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Date</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Time</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Sport</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Level</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Opponent</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Location</th>';
  html += '<th style="padding: 12px; text-align: left; font-weight: 600;">Status</th>';
  html += "</tr>";
  html += "</thead>";

  // Table body
  html += "<tbody>";
  games.forEach((game, index) => {
    const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">`;
    html += `<td style="padding: 12px;">${format(new Date(game.date), "EEE, MMM d, yyyy")}</td>`;
    html += `<td style="padding: 12px;">${game.time || "TBD"}</td>`;
    html += `<td style="padding: 12px;">${game.homeTeam.sport.name}</td>`;
    html += `<td style="padding: 12px;">${game.homeTeam.level}</td>`;
    html += `<td style="padding: 12px;">${game.opponent?.name || "TBD"}</td>`;
    html += `<td style="padding: 12px;">${game.isHome ? "<strong>Home</strong>" : game.venue?.name || "TBD"}</td>`;

    // Status with color
    const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
    html += `<td style="padding: 12px;"><span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${game.status}</span></td>`;
    html += "</tr>";

    // Add notes row if present
    if (game.notes) {
      html += `<tr style="background-color: ${bgColor};">`;
      html += `<td colspan="7" style="padding: 8px 12px; font-size: 13px; color: #6b7280; font-style: italic;">`;
      html += `<strong>Note:</strong> ${game.notes}`;
      html += "</td>";
      html += "</tr>";
    }
  });
  html += "</tbody>";
  html += "</table>";

  // Add footer with contact information
  html += '<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">';
  html += '<p style="color: #6b7280; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>';
  html += '<p style="color: #6b7280; font-size: 12px; margin: 8px 0;">This is an automated message from the Athletic Director Dashboard.</p>';
  html += "</div>";

  html += "</div>";

  return html;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const { to, subject, gameIds, additionalMessage, recipientCategory, groupId, campaignId } = body;

    // Validate inputs
    if (!to && !groupId) {
      return ApiResponse.error("Either 'to' or 'groupId' is required");
    }
    if (!subject) {
      return ApiResponse.error("Subject is required");
    }

    let toEmails: string[] = [];
    let emailBody: string;
    let campaign;

    // Case 1: Game schedule email with custom recipients or group
    if (gameIds && Array.isArray(gameIds) && gameIds.length > 0) {
      // Validate games belong to user's organization
      const games = await prisma.game.findMany({
        where: {
          id: { in: gameIds },
          homeTeam: {
            organizationId: session.user.organizationId,
          },
        },
        include: {
          homeTeam: {
            include: {
              sport: true,
            },
          },
          opponent: true,
          venue: true,
        },
      });

      if (games.length !== gameIds.length) {
        return ApiResponse.error("Some games were not found or you don't have access", 403);
      }

      // Build game schedule email body
      emailBody = buildScheduleEmailHTML(games, additionalMessage || "", recipientCategory || "");

      // Determine recipients
      if (groupId) {
        const group = await prisma.emailGroup.findUnique({
          where: { id: groupId, userId: session.user.id },
          include: { emails: true },
        });
        if (!group) {
          return ApiResponse.error("Group not found", 404);
        }
        toEmails = group.emails.map((e) => e.email);
      } else {
        if (!Array.isArray(to) || to.length === 0) {
          return ApiResponse.error("Valid recipients are required");
        }
        toEmails = to;
      }
    }
    // Case 2: Email campaign
    else if (campaignId) {
      campaign = await prisma.emailCampaign.findUnique({
        where: { id: campaignId, userId: session.user.id },
        include: { group: { include: { emails: true } } },
      });
      if (!campaign || !campaign.group) {
        return ApiResponse.error("Campaign or group not found", 404);
      }
      toEmails = campaign.group.emails.map((e) => e.email);
      emailBody = campaign.body;
      if (!subject) {
        return ApiResponse.error("Subject is required for campaign");
      }
      if (toEmails.length === 0) {
        return ApiResponse.error("No emails in group", 400);
      }
    } else {
      return ApiResponse.error("Either gameIds or campaignId is required");
    }

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "no-reply@yourdomain.com", // Replace with your verified Resend domain
      to: toEmails,
      subject,
      html: emailBody,
    });

    // Log the email in EmailLog
    const emailLog = await prisma.emailLog.create({
      data: {
        to: toEmails,
        cc: [],
        subject,
        body: emailBody,
        status: emailResponse.error ? "FAILED" : "SENT",
        error: emailResponse.error?.message || null,
        sentAt: emailResponse.error ? null : new Date(),
        sentById: session.user.id,
        gameId: gameIds && gameIds.length === 1 ? gameIds[0] : undefined, // Log single gameId if applicable
      },
    });

    // Update campaign sentAt if campaignId was provided
    if (campaignId && !emailResponse.error) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { sentAt: new Date() },
      });
    }

    if (emailResponse.error) {
      return ApiResponse.error(`Failed to send: ${emailResponse.error.message}`, 500);
    }

    return ApiResponse.success({ message: "Email sent successfully", emailLog });
  } catch (error) {
    return handleApiError(error);
  }
}
