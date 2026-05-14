import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { getReferralStats } from "@/lib/services/referral.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();

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
