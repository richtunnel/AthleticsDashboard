import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { syncGameToCalendar } from "@/lib/google/google-calendar-sync";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params; // Await params and use 'id' to match [id] folder name

    // Call the core sync logic
    const event = await syncGameToCalendar(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: "Game synced to Google Calendar.",
      data: {
        eventId: event.id,
        htmlLink: event.htmlLink,
      },
    });
  } catch (error: any) {
    console.error("Manual Sync Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync game.",
      },
      { status: 500 }
    );
  }
}
