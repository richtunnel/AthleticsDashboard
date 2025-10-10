import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";
import { emailService } from "@/lib/services/email.service";
import { format } from "date-fns";

interface Game {
  id: string;
  date: string;
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
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
  };
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const { to, subject, recipientCategory, games, additionalMessage } = body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return ApiResponse.error("Recipients are required");
    }

    if (!subject) {
      return ApiResponse.error("Subject is required");
    }

    if (!games || !Array.isArray(games) || games.length === 0) {
      return ApiResponse.error("At least one game must be selected");
    }

    // Build the email body
    const emailBody = buildScheduleEmailHTML(games, additionalMessage, recipientCategory);

    // Send the email
    const result = await emailService.sendEmail({
      to,
      subject,
      body: emailBody,
      sentById: session.user.id,
    });

    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
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
    const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#f59e0b";
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
