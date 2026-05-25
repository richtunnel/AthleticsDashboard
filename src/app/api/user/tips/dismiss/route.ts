import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/user/tips/dismiss
 * Body: { tipId: string }
 *
 * Appends `tipId` to the user's `dismissedTips` array (idempotent — duplicate
 * IDs are not added twice). Called when the user clicks "Got it" on a tip.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { tipId } = (await request.json().catch(() => ({}))) as { tipId?: string };

    if (!tipId || typeof tipId !== "string") {
      return NextResponse.json({ error: "tipId is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dismissedTips: true },
    });

    const current = Array.isArray(user?.dismissedTips)
      ? (user!.dismissedTips as unknown as string[])
      : [];

    if (current.includes(tipId)) {
      return NextResponse.json({ dismissed: current, alreadyDismissed: true });
    }

    const next = [...current, tipId];
    await prisma.user.update({
      where: { id: session.user.id },
      data: { dismissedTips: next },
    });

    return NextResponse.json({ dismissed: next });
  } catch (error) {
    console.error("[POST /api/user/tips/dismiss]", error);
    return NextResponse.json({ error: "Failed to dismiss tip" }, { status: 500 });
  }
}
