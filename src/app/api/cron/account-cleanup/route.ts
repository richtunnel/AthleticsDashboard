import { NextRequest, NextResponse } from "next/server";
import { getResendClientOptional } from "@/lib/resend";
import Stripe from "stripe";

import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { DAY_IN_MS, getAccountCleanupConfig } from "@/lib/utils/accountCleanup";
const emailFrom = process.env.EMAIL_FROM || "AD Hub <noreply@yourdomain.com>";
const appBaseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || "http://localhost:3000";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CleanupSummary {
  remindersSent: number;
  reminderBreakdown: Record<string, number>;
  accountsDeleted: number;
  stripeSubscriptionsCancelled: number;
  errors: string[];
}

type ReminderCandidate = {
  id: string;
  email: string | null;
  name: string | null;
  subscription: {
    deletionScheduledAt: Date | null;
    gracePeriodEndsAt: Date | null;
  } | null;
  organization: {
    name: string | null;
    timezone: string;
  } | null;
};

type DeletionCandidate = {
  id: string;
  email: string | null;
  name: string | null;
  subscription: {
    stripeSubscriptionId: string | null;
  } | null;
};

export async function POST(req: NextRequest) {
  const runStartedAt = new Date();
  const summary: CleanupSummary = {
    remindersSent: 0,
    reminderBreakdown: {},
    accountsDeleted: 0,
    stripeSubscriptionsCancelled: 0,
    errors: [],
  };

  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = extractSecret(req);
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendClient = getResendClientOptional();
  if (!resendClient) {
    return NextResponse.json({ error: "Email service is not configured" }, { status: 500 });
  }

  const config = getAccountCleanupConfig();
  console.log(`[AccountCleanup] Job started at ${runStartedAt.toISOString()} with reminder windows ${config.reminderWindows.join(",")}`);

  const now = new Date();

  // Reminder processing
  for (const windowDays of config.reminderWindows) {
    const windowStart = new Date(now.getTime() + Math.max(windowDays - 1, 0) * DAY_IN_MS);
    const windowEnd = new Date(now.getTime() + (windowDays + (windowDays === 0 ? 1 : 0)) * DAY_IN_MS);

    let reminderCandidates: ReminderCandidate[] = [];

    try {
      reminderCandidates = await prisma.user.findMany({
        where: {
          subscription: {
            is: {
              deletionScheduledAt: {
                gte: windowStart,
                lt: windowEnd,
              },
            },
          },
          accountDeletionReminders: {
            none: {
              daysBeforeDeletion: windowDays,
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          subscription: {
            select: {
              deletionScheduledAt: true,
              gracePeriodEndsAt: true,
            },
          },
          organization: {
            select: {
              name: true,
              timezone: true,
            },
          },
        },
      });
    } catch (error) {
      const errorMessage = `Failed to query reminder candidates for window ${windowDays} days: ${getErrorMessage(error)}`;
      console.error(`[AccountCleanup] ${errorMessage}`);
      summary.errors.push(errorMessage);
      continue;
    }

    if (!reminderCandidates.length) {
      continue;
    }

    for (const user of reminderCandidates) {
      const deletionScheduledAt = user.subscription?.deletionScheduledAt;
      if (!user.email || !deletionScheduledAt) {
        continue;
      }

      try {
        const countdownLabel = getCountdownLabel(windowDays);
        const formattedDeletionDate = formatDateTime(deletionScheduledAt, user.organization?.timezone);
        const organizationName = user.organization?.name ?? "your organization";
        const recipientName = user.name ?? "there";

        await resendClient.emails.send({
          from: emailFrom,
          to: user.email,
          subject: `Your Athletics Dashboard account will be deleted in ${countdownLabel}`,
          html: buildReminderEmailHtml({
            recipientName,
            organizationName,
            countdownLabel,
            deletionDate: formattedDeletionDate,
            appBaseUrl,
            gracePeriodDays: config.gracePeriodDays,
          }),
          text: buildReminderEmailText({
            recipientName,
            organizationName,
            countdownLabel,
            deletionDate: formattedDeletionDate,
            appBaseUrl,
            gracePeriodDays: config.gracePeriodDays,
          }),
        });

        await prisma.accountDeletionReminder.create({
          data: {
            userId: user.id,
            daysBeforeDeletion: windowDays,
          },
        });

        summary.remindersSent += 1;
        const key = String(windowDays);
        summary.reminderBreakdown[key] = (summary.reminderBreakdown[key] ?? 0) + 1;

        console.log(
          `[AccountCleanup] Reminder sent to user ${user.id} (${user.email}) for ${countdownLabel} before deletion scheduled at ${deletionScheduledAt.toISOString()}`,
        );
      } catch (error) {
        const errorMessage = `Failed to send reminder to user ${user.id}: ${getErrorMessage(error)}`;
        console.error(`[AccountCleanup] ${errorMessage}`);
        summary.errors.push(errorMessage);
      }
    }
  }

  // Deletion processing
  let stripeClient: Stripe | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      stripeClient = getStripe();
    } catch (error) {
      const errorMessage = `Stripe client unavailable: ${getErrorMessage(error)}`;
      console.error(`[AccountCleanup] ${errorMessage}`);
      summary.errors.push(errorMessage);
    }
  }

  let deletionCandidates: DeletionCandidate[] = [];
  try {
    deletionCandidates = await prisma.user.findMany({
      where: {
        subscription: {
          is: {
            deletionScheduledAt: {
              lte: now,
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscription: {
          select: {
            stripeSubscriptionId: true,
          },
        },
      },
    });
  } catch (error) {
    const errorMessage = `Failed to query deletion candidates: ${getErrorMessage(error)}`;
    console.error(`[AccountCleanup] ${errorMessage}`);
    summary.errors.push(errorMessage);
  }

  for (const user of deletionCandidates) {
    let subscriptionCancelled = false;
    const stripeSubscriptionId = user.subscription?.stripeSubscriptionId;

    if (stripeClient && stripeSubscriptionId) {
      try {
        const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId);
        if (subscription.status !== "canceled") {
          await stripeClient.subscriptions.cancel(stripeSubscriptionId);
          subscriptionCancelled = true;
          console.log(`[AccountCleanup] Cancelled Stripe subscription ${stripeSubscriptionId} for user ${user.id}`);
        }
      } catch (error) {
        const errorMessage = `Failed to cancel Stripe subscription ${stripeSubscriptionId} for user ${user.id}: ${getErrorMessage(error)}`;
        console.error(`[AccountCleanup] ${errorMessage}`);
        summary.errors.push(errorMessage);
      }
    }

    try {
      await prisma.$transaction([
        prisma.accountDeletionReminder.deleteMany({ where: { userId: user.id } }),
        prisma.user.delete({ where: { id: user.id } }),
      ]);

      summary.accountsDeleted += 1;
      if (subscriptionCancelled) {
        summary.stripeSubscriptionsCancelled += 1;
      }

      console.log(`[AccountCleanup] Deleted user ${user.id} (${user.email ?? "no-email"}) from system`);
    } catch (error) {
      const errorMessage = `Failed to delete user ${user.id}: ${getErrorMessage(error)}`;
      console.error(`[AccountCleanup] ${errorMessage}`);
      summary.errors.push(errorMessage);
    }
  }

  const durationMs = Date.now() - runStartedAt.getTime();
  console.log(
    `[AccountCleanup] Job completed in ${durationMs}ms. Reminders: ${summary.remindersSent}, Deletions: ${summary.accountsDeleted}, Errors: ${summary.errors.length}`,
  );

  return NextResponse.json(
    {
      runAt: runStartedAt.toISOString(),
      durationMs,
      ...summary,
    },
    { status: 200 },
  );
}

function extractSecret(req: NextRequest) {
  const header = req.headers.get("x-cron-secret")?.trim();
  if (header) {
    return header;
  }

  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return authorization;
}

function getCountdownLabel(days: number) {
  if (days <= 0) {
    return "less than 24 hours";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function formatDateTime(date: Date, timezone?: string | null) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone || "UTC",
    }).format(date);
  } catch (error) {
    console.error("[AccountCleanup] Failed to format date with timezone", timezone, error);
    return date.toISOString();
  }
}

function buildReminderEmailHtml(params: {
  recipientName: string;
  organizationName: string;
  countdownLabel: string;
  deletionDate: string;
  appBaseUrl: string;
  gracePeriodDays: number;
}) {
  const { recipientName, organizationName, countdownLabel, deletionDate, appBaseUrl: baseUrl, gracePeriodDays } = params;
  const manageUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/settings`;
  const graceLabel = gracePeriodDays === 1 ? "1 day" : `${gracePeriodDays} days`;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          background-color: #f9fafb;
          padding: 0;
          margin: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          padding: 32px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }
        h1 {
          color: #111827;
          font-size: 22px;
          margin-bottom: 16px;
        }
        p {
          margin: 12px 0;
        }
        .highlight {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px 16px;
          border-radius: 6px;
          font-weight: 600;
        }
        .cta {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background-color: #2563eb;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
        }
        .footer {
          margin-top: 32px;
          font-size: 12px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Account deletion scheduled (${countdownLabel} remaining)</h1>
        <p>Hi ${escapeHtml(recipientName)},</p>
        <p>This is a friendly reminder that the AthleticsDashboard account for ${escapeHtml(
          organizationName,
        )} is scheduled for permanent deletion on <strong>${escapeHtml(deletionDate)}</strong>.</p>
        <p class="highlight">Your data will be permanently removed after this time.</p>
        <p>If you wish to keep your account active, please log back in and reactivate your subscription before the deletion date.</p>
        <a class="cta" href="${manageUrl}">Review account settings</a>
        <p style="margin-top: 24px;">If you have any questions or need assistance, reply to this email or contact our support team.</p>
        <div class="footer">
          <p>This notification was sent because account cancellation was requested. The ${escapeHtml(
            graceLabel,
          )} grace period allows you to reactivate your subscription before data is removed.</p>
        </div>
      </div>
    </body>
  </html>`;
}

function buildReminderEmailText(params: {
  recipientName: string;
  organizationName: string;
  countdownLabel: string;
  deletionDate: string;
  appBaseUrl: string;
  gracePeriodDays: number;
}) {
  const { recipientName, organizationName, countdownLabel, deletionDate, appBaseUrl: baseUrl, gracePeriodDays } = params;
  const manageUrl = `${baseUrl.replace(/\/$/, "")}/dashboard/settings`;
  const graceLabel = gracePeriodDays === 1 ? "1 day" : `${gracePeriodDays} days`;

  return `Hi ${recipientName},

The AthleticsDashboard account for ${organizationName} is scheduled for permanent deletion on ${deletionDate} (${countdownLabel} remaining).

If you want to keep the account, please log in and reactivate your subscription before the deletion date: ${manageUrl}

This reminder is part of the ${graceLabel} grace period that follows cancellation. If you need help, just reply to this email and our team will assist you.
`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
