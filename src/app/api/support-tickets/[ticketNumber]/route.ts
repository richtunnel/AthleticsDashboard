import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { supportService } from "@/lib/services/support.service";

export async function PUT(request: NextRequest, { params }: { params: { ticketNumber: string } }) {
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

    const ticketNumber = decodeURIComponent(params.ticketNumber);

    const ticket = await supportService.getSupportTicket(ticketNumber);

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: "Support ticket not found",
        },
        { status: 404 }
      );
    }

    if (ticket.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized to update this support ticket",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const rawSubject = typeof body.subject === "string" ? body.subject.trim() : null;
    const rawDescription = typeof body.description === "string" ? body.description.trim() : null;

    if (!rawSubject && !rawDescription) {
      return NextResponse.json(
        {
          success: false,
          error: "No updates provided",
        },
        { status: 400 }
      );
    }

    const updateData: { subject?: string; description?: string } = {};
    if (rawSubject) {
      updateData.subject = rawSubject;
    }
    if (rawDescription) {
      updateData.description = rawDescription;
    }

    const updatedTicket = await supportService.updateSupportTicket(ticketNumber, updateData);

    return NextResponse.json(
      {
        success: true,
        data: {
          id: updatedTicket.id,
          ticketNumber: updatedTicket.ticketNumber,
          subject: updatedTicket.subject,
          status: updatedTicket.status,
          updatedAt: updatedTicket.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update support ticket",
      },
      { status: 500 }
    );
  }
}
