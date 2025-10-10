import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { syncGameToCalendar } from "@/lib/google/google-calendar-sync";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();

    // matches the file path [id]
    const gameId = params.id;

    if (!gameId) {
      return NextResponse.json({ success: false, error: "Game ID is missing." }, { status: 400 });
    }

    // Call the core sync logic
    const event = await syncGameToCalendar(gameId, session.user.id);

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
