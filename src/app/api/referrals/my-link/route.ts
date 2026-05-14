import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { generateReferralLink } from "@/lib/services/referral.service";
import { normalizeBrowserUrl } from "@/lib/utils/url";

export async function GET(request: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "";
    const referralLink = await generateReferralLink(session.user.id, baseUrl);

    return NextResponse.json({ referralLink }, { status: 200 });
  } catch (error) {
    console.error("[Referral API] Error generating referral link:", error);
    return NextResponse.json({ error: "Failed to generate referral link" }, { status: 500 });
  }
}
