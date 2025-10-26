import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { getReferralStats } from "@/lib/services/referral.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getReferralStats(session.user.id);

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("[Referral API] Error getting referral stats:", error);
    return NextResponse.json({ error: "Failed to get referral stats" }, { status: 500 });
  }
}
