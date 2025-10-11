// src/app/api/user/calendar-disconnect/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function POST() {
  try {
    const session = await requireAuth();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { googleCalendarRefreshToken: null }, // Set the token to null
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar Disconnect Error:", error);
    return NextResponse.json({ success: false, error: "Failed to disconnect." }, { status: 500 });
  }
}
