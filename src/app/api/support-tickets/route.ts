import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { supportService } from "@/lib/services/support.service";
import { emailService } from "@/lib/services/email.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized - Please sign in",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const rawSubject = typeof body.subject === "string" ? body.subject.trim() : "";
    const rawInitialMessage = typeof body.initialMessage === "string" ? body.initialMessage.trim() : "";

    if (!rawSubject || !rawInitialMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: subject and initialMessage",
        },
        { status: 400 }
      );
    }

    const userEmail = session.user.email;

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to determine user email for support ticket",
        },
        { status: 400 }
      );
    }

    const ticket = await supportService.createSupportTicket({
      userId: session.user.id,
      name: session.user.name || userEmail,
      email: userEmail,
      subject: rawSubject,
      initialMessage: rawInitialMessage,
    });

    try {
      await emailService.sendSupportTicketAcknowledgment({
        ticketNumber: ticket.ticketNumber,
        email: ticket.email,
        name: ticket.name,
        subject: ticket.subject,
        userId: session.user.id,
      });
    } catch (emailError) {
      console.error("Failed to send support ticket acknowledgment email:", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create support ticket",
      },
      { status: 500 }
    );
  }
}
