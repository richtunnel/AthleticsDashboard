import { NextRequest, NextResponse } from "next/server";
import { jobQueueService } from "@/lib/services/job-queue.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RETENTION_DAYS = 30;

export async function POST(req: NextRequest) {
  // Verify cron secret
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = extractSecret(req);
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  
  // Get retention days from query or use default
  const url = new URL(req.url);
  const retentionDays = parseInt(url.searchParams.get("retention_days") || String(DEFAULT_RETENTION_DAYS), 10);

  console.log(`[CleanupJobsCron] Starting job cleanup with ${retentionDays} day retention...`);

  try {
    const deletedCount = await jobQueueService.cleanup(retentionDays);

    const durationMs = Date.now() - startTime;
    console.log(`[CleanupJobsCron] Deleted ${deletedCount} old jobs in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[CleanupJobsCron] Cleanup error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

function extractSecret(req: NextRequest): string | null {
  const header = req.headers.get("x-cron-secret")?.trim();
  if (header) {
    return header;
  }

  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization) {
    return null;
  }

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return authorization;
}