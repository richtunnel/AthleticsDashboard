import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getResendClientOptional } from "@/lib/resend";
import { format } from "date-fns";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { requireAuth, hasPermission, WRITE_ROLES } from "@/lib/utils/auth";
import { validateBulkEmails } from "@/lib/utils/bulk-email";
import { buildEmailSignatureHTML } from "@/lib/utils/email-signature";
import { formatLevelDisplay } from "@/lib/utils/formatters";
import { getSiteUrl } from "@/lib/utils/siteUrl";
import { emailQueueService } from "@/lib/services/email-queue.service";

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
  customData?: Record<string, any>;
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
function getColumnLabel(columnId: string, customColumns: Array<{ id: string; name: string }> = []): string {
  if (columnId.startsWith("imported:")) {
    return columnId.split(":")[1] || columnId;
  }

  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customColumn = customColumns.find((col) => col.id === customId);
    return customColumn?.name || columnId;
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
    if (value === undefined || value === null) return "—";

    const strValue = String(value);

    // Check if it's an ISO date string and format it
    // Many imported dates come in as 2025-12-03T12:00:00.000Z
    if (typeof strValue === "string" && strValue.includes("T") && !isNaN(Date.parse(strValue))) {
      try {
        return format(new Date(strValue), "MM/dd/yyyy");
      } catch (e) {
        return strValue;
      }
    }

    return strValue;
  }

  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customData = (game.customData as Record<string, unknown>) || {};
    const value = customData[customId];
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
function buildScheduleEmailHTML(
  games: Game[],
  additionalMessage: string,
  signatureHTML: string,
  visibleColumnIds: string[],
  customColumns: Array<{ id: string; name: string }> = []
): string {
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
    html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb;">${escapeHtml(getColumnLabel(columnId, customColumns))}</th>`;
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
      customData: true,
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
    include: {
      accounts: {
        where: { provider: "google" },
        select: { provider: true },
        take: 1,
      },
    },
  });

  // Determine replyTo: use Google email if signed up with Google, otherwise use regular email
  const hasGoogleAccount = user?.accounts && user.accounts.length > 0;
  const replyTo = hasGoogleAccount
    ? (user?.googleCalendarEmail ?? user?.email)
    : user?.email;

  return {
    signatureHTML: user
      ? buildEmailSignatureHTML(
          {
            signaturePhone: user.signaturePhone,
            signatureWebsite: user.signatureWebsite,
            signatureLogoUrl: user.signatureLogoUrl,
            signatureText: user.signatureText,
          },
          {
            // Explicitly pass baseUrl to ensure relative URLs are converted to absolute URLs for email sending
            // useOptimizedImages defaults to false for production emails (optimization URLs don't work in external email clients)
            baseUrl: getSiteUrl(),
          }
        )
      : "",
    replyTo,
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

  // Fetch custom columns using the organizationId we already have
  const customColumns = await prisma.customColumn.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });

  const emailBody = buildScheduleEmailHTML(games, additionalMessage || "", signatureHTML, visibleColumnIds, customColumns);

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
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[EMAIL-API] ${requestId} - Request received`);
  
  try {
    const session = await requireAuth();
    console.log(`[EMAIL-API] ${requestId} - User authenticated: ${session.user.id}`);
    
    if (!hasPermission(session.user.role, WRITE_ROLES)) {
      console.warn(`[EMAIL-API] ${requestId} - Permission denied for user: ${session.user.id}`);
      return ApiResponse.forbidden();
    }

    const body = await request.json();
    const { to, subject, gameIds, additionalMessage, groupId, campaignId, visibleColumnIds, selectedSchoolNames, recipientCategory: requestRecipientCategory, customRecipients } = body;
    
    console.log(`[EMAIL-API] ${requestId} - Request params: gameIds=${gameIds?.length || 0}, groupId=${groupId}, campaignId=${campaignId}, directRecipients=${to?.length || 0}`);

    if (!to && !groupId && !campaignId) {
      console.error(`[EMAIL-API] ${requestId} - No recipients specified`);
      return ApiResponse.error("Either 'to', 'groupId', or 'campaignId' is required");
    }

    if (!subject || subject.trim() === "") {
      console.error(`[EMAIL-API] ${requestId} - Subject missing or empty`);
      return ApiResponse.error("Subject is required");
    }

    const resend = getResendClientOptional();
    if (!resend) {
      console.error(`[EMAIL-API] ${requestId} - Resend not configured`);
      return ApiResponse.error("Email service not configured. Please set RESEND_API_KEY.", 503);
    }

    let toEmails: string[];
    let emailBody: string;
    let replyTo: string | undefined;
    let campaign: any = null;
    let emailParams: any = {};

    if (gameIds && Array.isArray(gameIds) && gameIds.length > 0) {
      console.log(`[EMAIL-API] ${requestId} - Processing game schedule email`);
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
        visibleColumnIds: visibleColumnIds || [],
        selectedSchoolNames: selectedSchoolNames || [],
        recipientCategory: requestRecipientCategory || (groupId ? "emailGroup" : to ? "custom" : null),
        customRecipients: customRecipients || to || [],
      };
      console.log(`[EMAIL-API] ${requestId} - Game schedule email prepared for ${toEmails.length} recipients`);
    } else if (campaignId) {
      console.log(`[EMAIL-API] ${requestId} - Processing campaign email`);
      const result = await handleCampaignEmail(campaignId, session.user.id, subject);
      toEmails = result.toEmails;
      emailBody = result.emailBody;
      replyTo = result.replyTo;
      campaign = result.campaign;
      emailParams = { 
        campaignId,
        visibleColumnIds: visibleColumnIds || [],
        selectedSchoolNames: selectedSchoolNames || [],
        recipientCategory: "emailGroup",
        customRecipients: [],
      };
      console.log(`[EMAIL-API] ${requestId} - Campaign email prepared for ${toEmails.length} recipients`);
    } else {
      console.error(`[EMAIL-API] ${requestId} - Neither gameIds nor campaignId provided`);
      return ApiResponse.error("Either gameIds or campaignId is required");
    }

    const { valid: validEmails, invalid: invalidEmails } = validateBulkEmails(toEmails);

    if (invalidEmails.length > 0) {
      console.error(`[EMAIL-API] ${requestId} - Invalid emails detected:`, invalidEmails);
      return ApiResponse.error(`Invalid email addresses: ${invalidEmails.join(", ")}`, 400);
    }

    if (validEmails.length === 0) {
      console.error(`[EMAIL-API] ${requestId} - No valid email addresses`);
      return ApiResponse.error("No valid email addresses provided", 400);
    }

    console.log(`[EMAIL-API] ${requestId} - Validated ${validEmails.length} email addresses`);
    console.log(`[EMAIL-API] ${requestId} - Enqueueing bulk email...`);

    const job = await emailQueueService.enqueueBulkEmail({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      to: validEmails,
      subject,
      body: emailBody,
      ...emailParams,
    });

    console.log(`[EMAIL-API] ${requestId} - Email job enqueued: ${job.id}`);

    if (campaignId) {
      try {
        console.log(`[EMAIL-API] ${requestId} - Updating campaign sentAt timestamp`);
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { sentAt: new Date() },
        });
        console.log(`[EMAIL-API] ${requestId} - Campaign updated successfully`);
      } catch (err) {
        console.error(`[EMAIL-API] ${requestId} - Failed to update campaign sentAt:`, err);
      }
    }

    const message = `Successfully enqueued ${validEmails.length} email${validEmails.length > 1 ? "s" : ""} for sending`;

    return ApiResponse.success({
      message,
      result: {
        jobId: job.id,
        totalCount: validEmails.length,
      },
    });
  } catch (error) {
    console.error(`[EMAIL-API] Request failed:`, error);
    return await handleApiError(error);
  }
}
