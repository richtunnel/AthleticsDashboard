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

    // Send email notification to support (non-blocking)
    emailService.sendSupportNotificationEmail({
      type: 'ticket',
      submitter: {
        name: session.user.name || "Unknown",
        email: session.user.email || "",
      },
      subject,
      message: description,
      ticketNumber,
    }).catch(err => console.error('Failed to send support email:', err));

    // Send confirmation email to user (non-blocking)
    emailService.sendTicketConfirmationEmail({
      userEmail: session.user.email || "",
      userName: session.user.name || "User",
      ticketNumber,
      subject,
    }).catch(err => console.error('Failed to send ticket confirmation email:', err));

    // Send Slack notification (non-blocking)
    slackService.sendSupportTicketNotification({
      time: new Date().toISOString(),
      endpoint: '/api/support',
      customer: `${session.user.name} (${session.user.email})`,
      body: `Ticket: ${ticketNumber}\nSubject: ${subject}\n\n${description}`,
    }).catch(err => console.error('Failed to send Slack notification:', err));

    return NextResponse.json(
      {
        success: true,
        data: ticket,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create support ticket",
      },
      { status: 500 }
    );
  }
}
