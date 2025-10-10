// app/api/auth/calendar-connect/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline", // Required to get a Refresh Token
    scope: SCOPES,
    prompt: "consent", // Force user to re-consent, ensuring a refresh token is issued
  });

  return NextResponse.redirect(authUrl);
}
