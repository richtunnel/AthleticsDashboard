import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { slackService } from "@/lib/services/slack.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getAnySession();
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

    // Send email notification to support (non-blocking)
    emailService.sendSupportNotificationEmail({
      type: 'feedback',
      submitter: {
        name: submitterName,
        email: submitterEmail,
      },
      subject,
      message,
    }).catch(err => console.error('Failed to send support email:', err));

    // Send Slack notification (non-blocking)
    slackService.sendFeedbackNotification({
      time: new Date().toISOString(),
      endpoint: '/api/feedback',
      customer: `${submitterName} (${submitterEmail})`,
      body: `Subject: ${subject}\n\n${message}`,
    }).catch(err => console.error('Failed to send Slack notification:', err));

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
