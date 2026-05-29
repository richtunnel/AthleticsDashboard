import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { notifySlack } from "@/lib/services/slack.service";
import { buildSlackContext, toSlackContextRecord } from "@/lib/utils/slackContext";
import { rateLimit } from "@/lib/middleware/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 10 tickets/hour/user is plenty for real customers, blocks pathological loops.
    const rl = await rateLimit({ key: `support:${session.user.id}`, limit: 10, windowSec: 3600 });
    if (rl.response) return rl.response;

    const body = await request.json();
    const { subject, description } = body;

    if (!subject || !description) {
      return NextResponse.json(
        { success: false, error: "Subject and description are required" },
        { status: 400 }
      );
    }

    // Generate a unique ticket number
    const ticketCount = await prisma.supportTicket.count();
    const ticketNumber = `SUPPORT-${String(ticketCount + 1).padStart(6, "0")}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: session.user.id,
        name: session.user.name || "Unknown",
        email: session.user.email || "",
        subject,
        initialMessage: description,
        description,
        status: "OPEN",
      },
    });

    // ── PRIMARY DELIVERY: email to support@opletics.com ──────────────────
    // We await this so we know whether it actually went out. The function
    // now returns { ok, error } instead of swallowing — if Resend rejects
    // (unverified domain, missing API key, etc.) we surface the real reason
    // in the logs AND fire a critical-errors Slack so staff knows tickets
    // aren't reaching their inbox. The user request still succeeds because
    // the ticket itself is safely persisted to the DB above.
    const emailResult = await emailService.sendSupportNotificationEmail({
      type: 'ticket',
      submitter: {
        name: session.user.name || "Unknown",
        email: session.user.email || "",
      },
      subject,
      message: description,
      ticketNumber,
    });

    if (!emailResult.ok) {
      const { reportCriticalError } = await import("@/lib/utils/reportCriticalError");
      await reportCriticalError(
        request,
        new Error(`Support email to support@opletics.com failed: ${emailResult.error}`),
        { source: "/api/support email", Ticket: ticketNumber }
      );
    }

    // Confirmation email to user (best-effort — failure here doesn't warrant
    // a critical-errors page since the ticket is saved and staff still has
    // the primary email + Slack notification below).
    emailService.sendTicketConfirmationEmail({
      userEmail: session.user.email || "",
      userName: session.user.name || "User",
      ticketNumber,
      subject,
    }).catch(err => console.error('Failed to send ticket confirmation email:', err));

    // ── SUPPLEMENTARY: Slack notification ────────────────────────────────
    // Belt-and-suspenders so staff sees tickets in real-time even if email
    // delivery is degraded. Async via BullMQ, returns instantly, never blocks.
    try {
      const ctx = buildSlackContext(request, session);
      await notifySlack({
        channel: "ticket-support",
        title: `New Support Ticket — ${ticketNumber}`,
        message: `*Subject:* ${subject}\n\n${description}`,
        context: {
          Ticket: ticketNumber,
          ...toSlackContextRecord(ctx),
        },
      });
    } catch (slackErr) {
      console.error("Slack notification failed", slackErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: ticket,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating support ticket:", error);

    const { reportCriticalError } = await import("@/lib/utils/reportCriticalError");
    await reportCriticalError(request, error, { source: "/api/support" });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create support ticket",
      },
      { status: 500 }
    );
  }
}
