import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import crypto from "crypto";

import { authOptions } from "@/lib/utils/authOptions";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { createGoogleOAuth2Client } from "@/lib/google/auth";

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
  
  // Generate a secure CSRF token stored in OAuthState (not the password reset fields)
  const stateToken = crypto.randomUUID();

  await prisma.oAuthState.create({
    data: {
      userId,
      token: stateToken,
      returnTo: returnTo || null,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const state = Buffer.from(
    JSON.stringify({ 
      token: stateToken, 
      userId, 
      returnTo: returnTo || undefined 
    })
  ).toString("base64url");

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { refresh_token: true },
  });

  const oauth2Client = createGoogleOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    ...(account?.refresh_token ? {} : { prompt: "consent" }),
  });

  return NextResponse.redirect(authUrl);
}
