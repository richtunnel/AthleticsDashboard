import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { enableAccount } from "@/lib/services/account-disable.service";

/**
 * Manually enable a user account (remove disabled status)
 * Only accessible to ADMIN users
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow ADMIN to enable accounts manually
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await enableAccount({ userId });

    return NextResponse.json({ success: true, message: "Account enabled successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[EnableAccount] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to enable account" },
      { status: 500 }
    );
  }
}
