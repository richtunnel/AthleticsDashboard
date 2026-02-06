import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getResendClientOptional } from "@/lib/resend";
import { format } from "date-fns";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";
import { sendBulkEmail, validateBulkEmails } from "@/lib/utils/bulk-email";
import { buildEmailSignatureHTML } from "@/lib/utils/email-signature";
import { formatLevelDisplay } from "@/lib/utils/formatters";

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
  customFields?: Record<string, any>; // For imported CSV columns
}

// Helper to get column label
function getColumnLabel(columnId: string): string {
  // Handle imported columns
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];
    return columnName || columnId; // Use the CSV column name as-is, fallback to full ID if empty
  }

  // Return default labels
  switch (columnId) {
    case "date":
      return "Date";
    case "sport":
      return "Sport";
    case "level":
      return "Level";
    case "opponent":
      return "Opponent";
    case "isHome":
    case "location":
      return "Location";
    case "time":
      return "Time";
    case "status":
      return "Confirmed";
    case "notes":
      return "Notes";
    default:
      return columnId;
  }
}

// Helper to get cell value for a column
function getCellValue(game: Game, columnId: string): string {
  // Handle imported columns
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];

    // If column name is empty/malformed, return placeholder
    if (!columnName) {
      return "—";
    }

    const customFields = game.customFields;

    // Ensure customFields is a valid object (not null, array, or primitive)
    if (typeof customFields !== "object" || customFields === null || Array.isArray(customFields)) {
      return "—";
    }

    const value = customFields[columnName];
    return value !== undefined && value !== null ? String(value) : "—";
  }

  // Handle default columns
  switch (columnId) {
    case "date":
      return format(new Date(game.date), "MM/dd/yyyy");
    case "sport":
      return game.homeTeam.sport.name;
    case "level":
      return formatLevelDisplay(game.homeTeam.level);
    case "opponent":
      return game.opponent?.name || "TBD";
    case "isHome":
    case "location":
      return game.isHome ? "Home" : game.venue?.name || "TBD";
    case "time":
      return game.time || "TBD";
    case "status":
      return game.status;
    case "notes":
      return game.notes || "";
    default:
      return "";
  }
}

// Helper to escape HTML
function escapeHtml(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return "";
  }
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function buildScheduleEmailHTML(games: Game[], additionalMessage: string, category: string, signatureHTML: string, visibleColumnIds?: string[]): string {
  // Default to standard columns if not provided
  const columnsToShow = visibleColumnIds && visibleColumnIds.length > 0 ? visibleColumnIds.filter((id) => id !== "actions") : ["date", "time", "sport", "level", "opponent", "location", "status"];

  let html = '<div style="font-family: Arial, sans-serif; max-width: 1600px; margin: 0 auto;">';

  // Add greeting based on category
  html += '<h2 style="color: #23252a;">Game Schedule Confirmation</h2>';

  if (additionalMessage) {
    html += `<div style="margin-bottom: 24px; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #23252a; border-radius: 4px;">`;
    html += `<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(additionalMessage)}</p>`;
    html += "</div>";
  }

  // Add games table
  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">';

  // Table header - dynamically generate based on visible columns
  html += "<thead>";
  html += '<tr style="background-color: #23252a; color: white;">';
  columnsToShow.forEach((columnId) => {
    const label = getColumnLabel(columnId);
    html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb;">${escapeHtml(label)}</th>`;
  });
  html += "</tr>";
  html += "</thead>";

  // Table body
  html += "<tbody>";
  games.forEach((game, index) => {
    const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">`;

    // Generate cells dynamically based on visible columns
    columnsToShow.forEach((columnId) => {
      let cellContent = "";

      // Special handling for status column
      if (columnId === "status") {
        const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
        cellContent = `<span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span>`;
      }
      // Special handling for location/isHome column
      else if (columnId === "isHome" || columnId === "location") {
        cellContent = game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD");
      }
      // Default handling for other columns
      else {
        const rawValue = getCellValue(game, columnId);
        cellContent = escapeHtml(rawValue);
      }

      html += `<td style="padding: 12px; border: 1px solid #e5e7eb;">${cellContent}</td>`;
    });

    html += "</tr>";

    // Add notes row if notes column is visible and game has notes
    if (columnsToShow.includes("notes") && game.notes) {
      const colspan = columnsToShow.length;
      html += `<tr style="background-color: ${bgColor};">`;
      html += `<td colspan="${colspan}" style="padding: 8px 12px; font-size: 13px; color: #6b7280; font-style: italic; border: 1px solid #e5e7eb;">`;
      html += `<strong>Note:</strong> ${escapeHtml(game.notes)}`;
      html += "</td>";
      html += "</tr>";
    }
  });
  html += "</tbody>";
  html += "</table>";

  // Add footer with contact information
  html += '<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">';
  html += '<p style="color: #6b7280; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>';
  html += '<p style="color: #6b7280; font-size: 12px; margin: 8px 0;">This is an automated message from </p>';
  html += "</div>";

  // Add email signature if present
  if (signatureHTML) {
    html += signatureHTML;
  }

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
    const { to, subject, gameIds, additionalMessage, recipientCategory, groupId, campaignId, visibleColumnIds, customRecipients, selectedSchoolNames } = body;

    // Validate inputs
    if (!to && !groupId) {
      return ApiResponse.error("Either 'to' or 'groupId' is required");
    }
    if (!subject) {
      return ApiResponse.error("Subject is required");
    }

    // Fetch user's email signature
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        signaturePhone: true,
        signatureWebsite: true,
        signatureLogoUrl: true,
        signatureText: true,
      },
    });

    const signatureHTML = user
      ? buildEmailSignatureHTML({
          signaturePhone: user.signaturePhone,
          signatureWebsite: user.signatureWebsite,
          signatureLogoUrl: user.signatureLogoUrl,
          signatureText: user.signatureText,
        })
      : "";

    let replyTo: string | undefined;
    try {
      const rows = await prisma.$queryRaw<Array<{ schoolEmail: string | null }>>`
        SELECT "schoolEmail" FROM "User" WHERE id = ${session.user.id} LIMIT 1
      `;
      replyTo = rows[0]?.schoolEmail ?? undefined;
    } catch {
      replyTo = undefined;
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
        select: {
          id: true,
          date: true,
          time: true,
          status: true,
          isHome: true,
          notes: true,
          customFields: true,
          homeTeam: {
            select: {
              name: true,
              level: true,
              sport: {
                select: {
                  name: true,
                },
              },
            },
          },
          opponent: {
            select: {
              name: true,
            },
          },
          venue: {
            select: {
              name: true,
            },
          },
        },
      });

      if (games.length !== gameIds.length) {
        return ApiResponse.error("Some games were not found or you don't have access", 403);
      }

      // Build game schedule email body with signature and user's column selection
      emailBody = buildScheduleEmailHTML(games as Game[], additionalMessage || "", recipientCategory || "", signatureHTML, visibleColumnIds);

      // Determine recipients
      if (groupId) {
        const group = await prisma.emailGroup.findFirst({
          where: {
            id: groupId,
            organizationId: session.user.organizationId,
          },
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
      campaign = await prisma.emailCampaign.findFirst({
        where: {
          id: campaignId,
          userId: session.user.id,
        },
        include: { group: { include: { emails: true } } },
      });
      if (!campaign || !campaign.group) {
        return ApiResponse.error("Campaign or group not found", 404);
      }
      toEmails = campaign.group.emails.map((e) => e.email);
      // Append signature to campaign body
      emailBody = campaign.body + (signatureHTML || "");
      if (!subject) {
        return ApiResponse.error("Subject is required for campaign");
      }
      if (toEmails.length === 0) {
        return ApiResponse.error("No emails in group", 400);
      }
    } else {
      return ApiResponse.error("Either gameIds or campaignId is required");
    }

    // Validate emails
    const { valid: validEmails, invalid: invalidEmails } = validateBulkEmails(toEmails);

    if (invalidEmails.length > 0) {
      return ApiResponse.error(`Invalid email addresses: ${invalidEmails.join(", ")}`, 400);
    }

    if (validEmails.length === 0) {
      return ApiResponse.error("No valid email addresses provided", 400);
    }

    // Send emails using bulk email utility
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Resend API key missing — skipping email sending.");
      return ApiResponse.error("Email service not configured. Please set RESEND_API_KEY in environment variables.", 503);
    }

    const result = await sendBulkEmail({
      to: validEmails,
      subject,
      html: emailBody,
      sentById: session.user.id,
      replyTo: replyTo,
      gameIds: gameIds || [],
      groupId: groupId || null,
      campaignId: campaignId || null,
      recipientCategory: recipientCategory || null,
      additionalMessage: additionalMessage || null,
      customRecipients: Array.isArray(customRecipients) ? customRecipients : [],
      selectedSchoolNames: Array.isArray(selectedSchoolNames) ? selectedSchoolNames : [],
    });

    // Update campaign sentAt if campaignId was provided
    if (campaignId && result.success > 0) {
      try {
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { sentAt: new Date() },
        });
      } catch (campaignUpdateError) {
        console.error("Failed to update campaign sentAt:", campaignUpdateError);
        // Don't fail the request if campaign update fails
      }
    }

    if (result.failed > 0 && result.success === 0) {
      return ApiResponse.error(`Failed to send all emails. Errors: ${result.errors.map((e) => `${e.email}: ${e.error}`).join("; ")}`, 500);
    }

    const message = result.failed > 0 ? `Partially sent: ${result.success} succeeded, ${result.failed} failed` : `Successfully sent ${result.success} email${result.success > 1 ? "s" : ""}`;

    return ApiResponse.success({
      message,
      result: {
        success: result.success,
        failed: result.failed,
        errors: result.errors,
        emailLogIds: result.emailLogIds,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
