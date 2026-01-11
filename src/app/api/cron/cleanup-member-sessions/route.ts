import { NextResponse } from "next/server";
import { cleanupExpiredMemberSessions } from "@/lib/services/member-session-cleanup.service";

export async function GET() {
  try {
    // Verify this is an authenticated request from the server itself
    // In production, this should be protected by a secret token
    const secretToken = process.env.CRON_SECRET_TOKEN;
    const requestToken = new URL(request?.url || "http://localhost").searchParams.get("token");

    if (secretToken && requestToken !== secretToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron] Starting member session cleanup...");
    const deletedCount = await cleanupExpiredMemberSessions();

    return NextResponse.json({
      success: true,
      deletedSessions: deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Error during member session cleanup:", error);
    return NextResponse.json(
      { error: "Cleanup failed", message: String(error) },
      { status: 500 }
    );
  }
}
