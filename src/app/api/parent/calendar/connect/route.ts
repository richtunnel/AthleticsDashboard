import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { initiateIncrementalAuth } from "@/lib/services/incremental-auth.service";
import { getSiteUrl } from "@/lib/utils/siteUrl";

/**
 * POST /api/parent/calendar/connect
 *
 * Initiates Google Calendar OAuth for the parent user.
 * Uses ONLY the parent session — never the AD session.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const returnTo = body.returnTo || "/parent-dashboard/calendar";
    const callbackUrl =
      process.env.GOOGLE_REDIRECT_URI || `${getSiteUrl()}/api/auth/calendar-callback`;

    const result = await initiateIncrementalAuth(user.id, "CALENDAR", callbackUrl, returnTo);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to initiate authorization" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, authUrl: result.authUrl });
  } catch (error) {
    console.error("[API] Error initiating parent calendar connection:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
