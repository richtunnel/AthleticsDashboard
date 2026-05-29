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

    // Rate limit by user when authenticated, else by IP. Anonymous homepage
    // submissions are the most spam-prone — 5/hour is generous for a real
    // person but caps a bot at low triple digits/day.
    const rlKey = session?.user?.id
      ? `feedback:${session.user.id}`
      : `feedback:ip:${request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"}`;
    const rl = await rateLimit({ key: rlKey, limit: 5, windowSec: 3600 });
    if (rl.response) return rl.response;

    const body = await request.json();
    const { subject, message, name, email } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "Subject and message are required" },
        { status: 400 }
      );
    }

    // For non-authenticated users, name and email are required
    if (!session?.user && (!name || !email)) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Use session data if authenticated, otherwise use provided data
    const submitterName = session?.user?.name || name || "Unknown";
    const submitterEmail = session?.user?.email || email || "";
    const userId = session?.user?.id || null;

    const feedback = await prisma.feedbackSubmission.create({
      data: {
        userId,
        name: submitterName,
        email: submitterEmail,
        subject,
        message,
      },
    });

    // Email notification — best-effort, never blocks the response.
    emailService.sendSupportNotificationEmail({
      type: 'feedback',
      submitter: {
        name: submitterName,
        email: submitterEmail,
      },
      subject,
      message,
    }).catch(err => console.error('Failed to send support email:', err));

    // ── Slack notification — route by submitter ──────────────────────────
    //   Authenticated AD/staff → ad-feedback
    //   Anonymous (homepage form, no session) → homepage-feedback
    // Parent feedback comes through /api/parent/feedback so it isn't a case here.
    try {
      const ctx = buildSlackContext(request, session, {
        name: submitterName,
        email: submitterEmail,
      });
      const channel = session?.user ? "ad-feedback" : "homepage-feedback";
      const title = session?.user ? "New AD Feedback" : "New Homepage Feedback";
      await notifySlack({
        channel,
        title,
        message: `*Subject:* ${subject}\n\n${message}`,
        context: toSlackContextRecord(ctx),
      });
    } catch (slackErr) {
      console.error("Slack notification failed", slackErr);
    }

    return NextResponse.json(
      {
        success: true,
        data: feedback,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to submit feedback",
      },
      { status: 500 }
    );
  }
}
