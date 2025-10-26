import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

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
