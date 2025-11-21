import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { disableAccount } from "@/lib/services/account-disable.service";
import type { DisableReason } from "@/lib/services/account-disable.service";

/**
 * Manually disable a user account
 * Only accessible to SUPER_ADMIN users
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow SUPER_ADMIN to disable accounts manually
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const validReasons: DisableReason[] = ["PAYMENT_OVERDUE", "MANUAL", "ADMIN_ACTION", "VIOLATION"];
    const disableReason: DisableReason = validReasons.includes(reason) ? reason : "ADMIN_ACTION";

    await disableAccount({ userId, reason: disableReason });

    return NextResponse.json({ success: true, message: "Account disabled successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[DisableAccount] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disable account" },
      { status: 500 }
    );
  }
}
