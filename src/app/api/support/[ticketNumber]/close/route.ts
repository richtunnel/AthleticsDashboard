import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { ticketNumber } = await params;

    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketNumber },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationId: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Verify ownership or organization
    if (ticket.userId !== session.user.id && ticket.user?.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Check if ticket is already closed
    if (ticket.status === "CLOSED") {
      return NextResponse.json(
        { success: false, error: "Ticket is already closed" },
        { status: 400 }
      );
    }

    // Update ticket status to CLOSED
    const updatedTicket = await prisma.supportTicket.update({
      where: { ticketNumber },
      data: {
        status: "CLOSED",
      },
    });

    // Send notification email to support team
    try {
      await emailService.sendTicketClosedNotification({
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        closedBy: {
          name: session.user.name || "Unknown",
          email: session.user.email || "unknown@example.com",
        },
      });
    } catch (emailError) {
      console.error("Failed to send ticket closed notification:", emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    console.error("Error closing support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to close support ticket",
      },
      { status: 500 }
    );
  }
}
