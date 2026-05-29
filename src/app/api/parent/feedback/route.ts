import { getParentSession } from "@/lib/utils/parentSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { notifySlack } from "@/lib/services/slack.service";
import { buildSlackContext, toSlackContextRecord } from "@/lib/utils/slackContext";
import { rateLimit } from "@/lib/middleware/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimit({ key: `parent-feedback:${session.user.id}`, limit: 5, windowSec: 3600 });
    if (rl.response) return rl.response;

    const body = await request.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "Subject and message are required" },
        { status: 400 }
      );
    }

    const submitterName = session.user.name || "Parent";
    const submitterEmail = session.user.email || "";
    const userId = session.user.id;

    const feedback = await prisma.feedbackSubmission.create({
      data: {
        userId,
        name: submitterName,
        email: submitterEmail,
        subject,
        message,
      },
    });

    emailService
      .sendSupportNotificationEmail({
        type: "feedback",
        submitter: {
          name: submitterName,
          email: submitterEmail,
        },
        subject,
        message,
      })
      .catch((err) => console.error("Failed to send support email:", err));

    try {
      const ctx = buildSlackContext(request, { user: { ...session.user, role: "PARENT" } });
      await notifySlack({
        channel: "parent-feedback",
        title: "New Parent Feedback",
        message: `*Subject:* ${subject}\n\n${message}`,
        context: toSlackContextRecord(ctx),
      });
    } catch (slackErr) {
      console.error("Slack notification failed", slackErr);
    }

    return NextResponse.json({ success: true, data: feedback }, { status: 201 });
  } catch (error) {
    console.error("Error creating parent feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
