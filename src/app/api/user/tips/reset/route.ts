import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/user/tips/reset
 *
 * Clears the user's `dismissedTips` array so every onboarding tip is shown
 * again on next page load. Called from Settings → Other → "Show tutorial tips".
 */
export async function POST() {
  try {
    const session = await requireAuth();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { dismissedTips: [] },
    });

    return NextResponse.json({ dismissed: [] });
  } catch (error) {
    console.error("[POST /api/user/tips/reset]", error);
    return NextResponse.json({ error: "Failed to reset tips" }, { status: 500 });
  }
}
