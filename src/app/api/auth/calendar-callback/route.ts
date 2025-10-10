import { NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAuth } from "@/lib/utils/auth"; // Your auth helper
import { prisma } from "@/lib/database/prisma"; // Your prisma client

export async function GET(request: Request) {
  try {
    const session = await requireAuth(); // Ensure user is logged in
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

    const { tokens } = await oauth2Client.getToken(code);

    if (tokens.refresh_token) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { googleCalendarRefreshToken: tokens.refresh_token },
      });
    }

    // Redirect the user back to the dashboard/games page
    return NextResponse.redirect(new URL("/dashboard/games?calendar_connected=true", request.url));
  } catch (error) {
    console.error("Calendar OAuth Error:", error);
    return NextResponse.json({ error: "Failed to connect calendar." }, { status: 500 });
  }
}
