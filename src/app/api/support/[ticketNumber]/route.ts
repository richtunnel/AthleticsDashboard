import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

export async function GET(
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

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error fetching support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch support ticket",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const { subject, description } = body;

    const ticket = await prisma.supportTicket.findUnique({
      where: { ticketNumber },
      include: {
        user: {
          select: {
            id: true,
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

    const updatedTicket = await prisma.supportTicket.update({
      where: { ticketNumber },
      data: {
        ...(subject && { subject }),
        ...(description && { description }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedTicket,
    });
  } catch (error) {
    console.error("Error updating support ticket:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update support ticket",
      },
      { status: 500 }
    );
  }
}
