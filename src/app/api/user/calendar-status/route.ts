import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { googleCalendarRefreshToken: true },
    });

    const isConnected = !!user?.googleCalendarRefreshToken;

    return NextResponse.json({ isConnected });
  } catch (error) {
    // If auth fails or any error occurs, assume not connected
    return NextResponse.json({ isConnected: false, error: "Authentication failed or user not found." }, { status: 200 });
  }
}
