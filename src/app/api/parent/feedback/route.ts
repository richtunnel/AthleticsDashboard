import { getParentSession } from "@/lib/utils/parentSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { slackService } from "@/lib/services/slack.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

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

    // Send email notification (non-blocking)
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

    // Send Slack notification (non-blocking)
    slackService
      .sendFeedbackNotification({
        time: new Date().toISOString(),
        endpoint: "/api/parent/feedback",
        customer: `${submitterName} (${submitterEmail}) [parent]`,
        body: `Subject: ${subject}\n\n${message}`,
      })
      .catch((err) => console.error("Failed to send Slack notification:", err));

    return NextResponse.json({ success: true, data: feedback }, { status: 201 });
  } catch (error) {
    console.error("Error creating parent feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
