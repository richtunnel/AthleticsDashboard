import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/utils/authOptions";
import { getParentSession } from "@/lib/utils/parentSession";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/contacts.readonly",
];

export async function GET(request: NextRequest) {
  // Check if user is logged in (AD or Parent)
  let session = await getServerSession(authOptions);
  let isParent = false;

  if (!session?.user) {
    session = await getParentSession();
    isParent = true;
  }

  if (!session?.user) {
    console.error("❌ User not logged in - cannot connect calendar");
    const loginUrl = isParent ? "/onboarding/parent-signup" : "/login";
    return NextResponse.redirect(new URL(`${loginUrl}?error=login_required`, process.env.NEXTAUTH_URL!));
  }

  console.log("🔗 Starting calendar OAuth for:", session.user.email);

  const userId = (session.user as any).id;
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const state = returnTo
    ? Buffer.from(JSON.stringify({ userId, returnTo })).toString("base64url")
    : userId;

  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
    state,
  });

  return NextResponse.redirect(authUrl);
}
