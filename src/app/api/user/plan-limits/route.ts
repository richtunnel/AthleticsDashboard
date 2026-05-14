import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextResponse } from "next/server";
import { getWorksheetLimit, getEmailLimit, getUserPlanInfo } from "@/lib/security/plan-limits";

export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const worksheetLimit = await getWorksheetLimit(session.user.id);
    const emailLimit = await getEmailLimit(session.user.id);
    const planInfo = await getUserPlanInfo(session.user.id);

    return NextResponse.json({
      worksheetLimit,
      emailLimit,
      planType: planInfo?.planType,
      isTrialActive: planInfo?.isTrialActive,
    });
  } catch (error) {
    console.error("Failed to fetch plan limits:", error);
    return NextResponse.json({ error: "Failed to fetch plan limits" }, { status: 500 });
  }
}
