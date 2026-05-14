import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await getAnySession();

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const tickets = await prisma.supportTicket.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        createdAt: true,
        name: true,
      },
    });

    return NextResponse.json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch support tickets",
      },
      { status: 500 }
    );
  }
}
