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
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
  };
  notes?: string | null;
  customFields?: Record<string, any>;
}

// Simple HTML escaping
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Get column label
function getColumnLabel(columnId: string): string {
  if (columnId.startsWith("imported:")) {
    return columnId.split(":")[1] || columnId;
  }

  const labels: Record<string, string> = {
    date: "Date",
    sport: "Sport",
    level: "Level",
    opponent: "Opponent",
    isHome: "Location",
    location: "Location",
    time: "Time",
    status: "Confirmed",
    notes: "Notes",
  };

  return labels[columnId] || columnId;
}

// Get cell value for a column
function getCellValue(game: Game, columnId: string): string {
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];
    if (!columnName || typeof game.customFields !== "object" || !game.customFields) return "—";
    const value = game.customFields[columnName];
    return value !== undefined && value !== null ? String(value) : "—";
  }

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
      return game.isHome ? "Home" : (game.venue?.name || "TBD");
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

// Build game schedule email HTML
function buildScheduleEmailHTML(games: Game[], additionalMessage: string, signatureHTML: string, visibleColumnIds: string[]): string {
  const columnsToShow = visibleColumnIds.length > 0 ? visibleColumnIds.filter((id) => id !== "actions") : ["date", "time", "sport", "level", "opponent", "location", "status"];

  let html = '<div style="font-family: Arial, sans-serif; max-width: 1600px; margin: 0 auto;">';
  html += '<h2 style="color: #23252a;">Game Schedule Confirmation</h2>';

  if (additionalMessage) {
    html += `<div style="margin-bottom: 24px; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #23252a; border-radius: 4px;">`;
    html += `<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(additionalMessage)}</p>`;
    html += "</div>";
  }

  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">';
  html += "<thead><tr style='background-color: #23252a; color: white;'>";

  columnsToShow.forEach((columnId) => {
    html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb;">${escapeHtml(getColumnLabel(columnId))}</th>`;
  });

  html += "</tr></thead><tbody>";

  games.forEach((game, index) => {
    const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">`;

    columnsToShow.forEach((columnId) => {
      let cellContent = "";

      if (columnId === "status") {
        const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
        cellContent = `<span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span>`;
      } else if (columnId === "isHome" || columnId === "location") {
        cellContent = game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD");
      } else {
        cellContent = escapeHtml(getCellValue(game, columnId));
      }

      html += `<td style="padding: 12px; border: 1px solid #e5e7eb;">${cellContent}</td>`;
    });

    html += "</tr>";

    if (columnsToShow.includes("notes") && game.notes) {
      html += `<tr style="background-color: ${bgColor};">`;
      html += `<td colspan="${columnsToShow.length}" style="padding: 8px 12px; font-size: 13px; color: #6b7280; font-style: italic; border: 1px solid #e5e7eb;">`;
      html += `<strong>Note:</strong> ${escapeHtml(game.notes)}</td></tr>`;
    }
  });

  html += "</tbody></table>";
  html += '<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">';
  html += '<p style="color: #6b7280; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>';
  html += '<p style="color: #6b7280; font-size: 12px; margin: 8px 0;">This is an automated message from Opletics</p></div>';

  if (signatureHTML) {
    html += signatureHTML;
  }

  html += "</div>";
  return html;
}

// Fetch games with validation
async function fetchGames(gameIds: string[], organizationId: string): Promise<Game[]> {
  const games = await prisma.game.findMany({
    where: {
      id: { in: gameIds },
      homeTeam: { organizationId },
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
          sport: { select: { name: true } },
        },
      },
      opponent: { select: { name: true } },
      venue: { select: { name: true } },
    },
  });

  if (games.length !== gameIds.length) {
    throw new Error("Some games were not found or you don't have access");
  }

  return games as Game[];
}

// Get recipient emails
async function getRecipientEmails(groupId: string | undefined, to: string[] | undefined, organizationId: string): Promise<string[]> {
  if (groupId) {
    const group = await prisma.emailGroup.findFirst({
      where: { id: groupId, organizationId },
      include: { emails: true },
    });
    if (!group) throw new Error("Group not found");
    return group.emails.map((e) => e.email);
  }

  if (!to || to.length === 0) {
    throw new Error("Valid recipients are required");
  }

  return to;
}

// Get user signature
async function getUserSignature(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      signaturePhone: true,
      signatureWebsite: true,
      signatureLogoUrl: true,
      signatureText: true,
      schoolEmail: true,
    },
  });

  return {
    signatureHTML: user
      ? buildEmailSignatureHTML({
          signaturePhone: user.signaturePhone,
          signatureWebsite: user.signatureWebsite,
          signatureLogoUrl: user.signatureLogoUrl,
          signatureText: user.signatureText,
        })
      : "",
    replyTo: user?.schoolEmail ?? undefined,
  };
}

// Handle game schedule email
async function handleGameScheduleEmail(
  gameIds: string[],
  organizationId: string,
  userId: string,
  groupId: string | undefined,
  to: string[] | undefined,
  subject: string,
  additionalMessage: string,
  visibleColumnIds: string[]
) {
  const games = await fetchGames(gameIds, organizationId);
  const toEmails = await getRecipientEmails(groupId, to, organizationId);
  const { signatureHTML, replyTo } = await getUserSignature(userId);

  const emailBody = buildScheduleEmailHTML(games, additionalMessage || "", signatureHTML, visibleColumnIds);

  return { toEmails, emailBody, replyTo, gameIds, groupId };
}

// Handle campaign email
async function handleCampaignEmail(campaignId: string, userId: string, subject: string) {
  const campaign = await prisma.emailCampaign.findFirst({
    where: { id: campaignId, userId },
    include: { group: { include: { emails: true } } },
  });

  if (!campaign || !campaign.group) {
    throw new Error("Campaign or group not found");
  }

  const { signatureHTML, replyTo } = await getUserSignature(userId);
  const toEmails = campaign.group.emails.map((e) => e.email);

  if (toEmails.length === 0) {
    throw new Error("No emails in group");
  }

  if (!subject) {
    throw new Error("Subject is required for campaign");
  }

  const emailBody = campaign.body + (signatureHTML || "");

  return { toEmails, emailBody, replyTo, campaignId, campaign };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const { to, subject, gameIds, additionalMessage, groupId, campaignId, visibleColumnIds } = body;

    if (!to && !groupId && !campaignId) {
      return ApiResponse.error("Either 'to', 'groupId', or 'campaignId' is required");
    }

    if (!subject) {
      return ApiResponse.error("Subject is required");
    }

    const resend = getResendClientOptional();
    if (!resend) {
      return ApiResponse.error("Email service not configured. Please set RESEND_API_KEY.", 503);
    }

    let toEmails: string[];
    let emailBody: string;
    let replyTo: string | undefined;
    let campaign: any = null;
    let emailParams: any = {};

    if (gameIds && Array.isArray(gameIds) && gameIds.length > 0) {
      const result = await handleGameScheduleEmail(
        gameIds,
        session.user.organizationId,
        session.user.id,
        groupId,
        to,
        subject,
        additionalMessage,
        visibleColumnIds || []
      );
      toEmails = result.toEmails;
      emailBody = result.emailBody;
      replyTo = result.replyTo;
      emailParams = {
        gameIds: result.gameIds,
        groupId: result.groupId,
      };
    } else if (campaignId) {
      const result = await handleCampaignEmail(campaignId, session.user.id, subject);
      toEmails = result.toEmails;
      emailBody = result.emailBody;
      replyTo = result.replyTo;
      campaign = result.campaign;
      emailParams = { campaignId };
    } else {
      return ApiResponse.error("Either gameIds or campaignId is required");
    }

    const { valid: validEmails, invalid: invalidEmails } = validateBulkEmails(toEmails);

    if (invalidEmails.length > 0) {
      return ApiResponse.error(`Invalid email addresses: ${invalidEmails.join(", ")}`, 400);
    }

    if (validEmails.length === 0) {
      return ApiResponse.error("No valid email addresses provided", 400);
    }

    const result = await sendBulkEmail({
      to: validEmails,
      subject,
      html: emailBody,
      sentById: session.user.id,
      replyTo,
      ...emailParams,
    });

    if (campaignId && result.success > 0) {
      try {
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { sentAt: new Date() },
        });
      } catch (err) {
        console.error("Failed to update campaign sentAt:", err);
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
