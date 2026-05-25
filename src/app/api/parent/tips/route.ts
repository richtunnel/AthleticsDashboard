import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/parent/tips
 *
 * Parent-session-scoped variant of /api/user/tips. Parents authenticate
 * through a separate JWT cookie, so we resolve the session via
 * `getParentSession` rather than `requireAuth` (which only sees the AD
 * cookie). The persisted `dismissedTips` field on User is shared by both
 * roles — each user has their own set regardless of which dashboard they
 * use.
 */
export async function GET() {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: (session.user as { id: string }).id },
      select: { dismissedTips: true },
    });

    const dismissed = Array.isArray(user?.dismissedTips)
      ? (user!.dismissedTips as unknown as string[])
      : [];

    return NextResponse.json({ dismissed });
  } catch (error) {
    console.error("[GET /api/parent/tips]", error);
    return NextResponse.json({ error: "Failed to load tip state" }, { status: 500 });
  }
}
