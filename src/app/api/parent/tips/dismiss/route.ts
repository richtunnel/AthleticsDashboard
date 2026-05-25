import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";

/**
 * POST /api/parent/tips/dismiss
 * Body: { tipId: string }
 *
 * Marks an onboarding tip as dismissed for the current parent user.
 * Idempotent — re-posting the same tipId is a no-op.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { tipId } = (await request.json().catch(() => ({}))) as { tipId?: string };
    if (!tipId || typeof tipId !== "string") {
      return NextResponse.json({ error: "tipId is required" }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      where: { id: userId },
      data: { dismissedTips: next },
    });

    return NextResponse.json({ dismissed: next });
  } catch (error) {
    console.error("[POST /api/parent/tips/dismiss]", error);
    return NextResponse.json({ error: "Failed to dismiss tip" }, { status: 500 });
  }
}
