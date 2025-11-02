import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import { slackService } from "@/lib/services/slack.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subject, message } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "Subject and message are required" },
        { status: 400 }
      );
    }

    const feedback = await prisma.feedbackSubmission.create({
      data: {
        userId: session.user.id,
        name: session.user.name || "Unknown",
        email: session.user.email || "",
        subject,
        message,
      },
    });

    // Send email notification to support (non-blocking)
    emailService.sendSupportNotificationEmail({
      type: 'feedback',
      submitter: {
        name: session.user.name || "Unknown",
        email: session.user.email || "",
      },
      subject,
      message,
    }).catch(err => console.error('Failed to send support email:', err));

    // Send Slack notification (non-blocking)
    slackService.sendFeedbackNotification({
      time: new Date().toISOString(),
      endpoint: '/api/feedback',
      customer: `${session.user.name} (${session.user.email})`,
      body: `Subject: ${subject}\n\n${message}`,
      type: 'feedback',
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
