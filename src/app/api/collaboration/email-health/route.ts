import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { checkEmailServiceHealth } from "@/lib/utils/emailHealth";

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 }
      );
    }

    const health = await checkEmailServiceHealth();

    return NextResponse.json({
      success: true,
      ...health,
    });
  } catch (error) {
    console.error("Error checking email health:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while checking email service status" },
      { status: 500 }
    );
  }
}
