import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/user/tips
 *
 * Returns the IDs of onboarding tips the current user has dismissed.
 * Used by TipsProvider on mount to know which TipBubbles to suppress.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dismissedTips: true },
    });

    const dismissed = Array.isArray(user?.dismissedTips)
      ? (user!.dismissedTips as unknown as string[])
      : [];

    // Always return the same shape so the client can cache it stably
    return NextResponse.json({ dismissed });
  } catch (error) {
    console.error("[GET /api/user/tips]", error);
    return NextResponse.json({ error: "Failed to load tip state" }, { status: 500 });
  }
}
