import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * POST /api/parent/update-plan
 * Updates the plan/donation amount for the authenticated parent user.
 * Uses the parent session (parent-session-token) instead of the main AD session
 * so that pure parent users (who never have a main next-auth session) can update
 * their plan after completing onboarding.
 *
 * Body:
 *   plan            – "parent_free" | "parent_donation"
 *   donationAmount  – number (optional)
 *   donationInterval – "month" | "year" (optional)
 */
export async function POST(request: NextRequest) {
  const session = await getParentSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { plan, donationAmount, donationInterval } = body;

    if (!plan) {
      return NextResponse.json({ error: "Plan is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only update plan for PARENT role users — ADs/coaches who also use the
    // parent portal keep their primary plan intact.
    if (user.role !== "PARENT") {
      return NextResponse.json({ success: true, message: "Plan unchanged for non-parent role" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { plan },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error updating parent plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
