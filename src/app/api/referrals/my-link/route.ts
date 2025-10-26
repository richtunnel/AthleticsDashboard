import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { generateReferralLink } from "@/lib/services/referral.service";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = request.nextUrl.origin;
    const referralLink = await generateReferralLink(session.user.id, baseUrl);

    return NextResponse.json({ referralLink }, { status: 200 });
  } catch (error) {
    console.error("[Referral API] Error generating referral link:", error);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 500 });
  }
}
