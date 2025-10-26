import { NextRequest, NextResponse } from "next/server";
import { trackReferral } from "@/lib/services/referral.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referrerEmail, newUserEmail, newUserId } = body;

    if (!referrerEmail || !newUserEmail || !newUserId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await trackReferral(referrerEmail, newUserId, newUserEmail);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Referral API] Error tracking referral:", error);
    return NextResponse.json({ error: "Failed to track referral" }, { status: 500 });
  }
}
