import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/parent/tips/reset
 *
 * Clears every dismissed onboarding tip for the current parent so every
 * TipBubble shows again on next page load. Triggered from
 * parent-dashboard → Settings → "Show tutorial tips again".
 */
export async function POST() {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: (session.user as { id: string }).id },
      data: { dismissedTips: [] },
    });

    return NextResponse.json({ dismissed: [] });
  } catch (error) {
    console.error("[POST /api/parent/tips/reset]", error);
    return NextResponse.json({ error: "Failed to reset tips" }, { status: 500 });
  }
}
