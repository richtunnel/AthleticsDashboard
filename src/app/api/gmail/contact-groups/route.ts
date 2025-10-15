import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { refreshGoogleToken } from "@/lib/google/auth"; // Import from your util
import { getUserContactGroups } from "@/lib/google/google-contacts-sync";

export async function GET(req: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get refresh token from user's Google account
  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "google",
    },
  });

  if (!account?.refresh_token) {
    return NextResponse.json({ error: "Google account not connected" }, { status: 400 });
  }

  // Refresh access token using the utility function
  const accessToken = await refreshGoogleToken(account.refresh_token);

  // Fetch contact groups
  const groups = await getUserContactGroups(accessToken);

  return NextResponse.json({ groups });
}
