import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export async function GET() {
  // Check if user is logged in BEFORE starting OAuth
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    console.error("❌ User not logged in - cannot connect calendar");
    return NextResponse.redirect(new URL("/login?error=login_required", process.env.NEXTAUTH_URL!));
  }

  console.log("🔗 Starting calendar OAuth for:", session.user.email);

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
    state: session.user.id, // Optional: pass user ID for extra verification
  });

  return NextResponse.redirect(authUrl);
}
