import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { hasScopes } from "@/lib/services/incremental-auth.service";

export async function GET() {
  try {
    const session = await requireAuth();

    // Use the same calendar scope check as the settings page
    const isConnected = await hasScopes(session.user.id, "CALENDAR");

    return NextResponse.json({ isConnected });
  } catch (error) {
    // If auth fails or any error occurs, assume not connected
    return NextResponse.json({ isConnected: false, error: "Authentication failed or user not found." }, { status: 200 });
  }
}
