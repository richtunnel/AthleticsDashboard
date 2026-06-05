import { NextRequest, NextResponse } from "next/server";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { prisma } from "@/lib/database/prisma";

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

    // ── Stuck-PROCESSING reaper ─────────────────────────────────────────────
    // Reset any job stuck in PROCESSING for > 10 min (crashed or killed worker).
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const reaperRecovered = await prisma.$executeRaw`
      UPDATE "BackgroundJob"
      SET "status" = 'PENDING', "updatedAt" = NOW(),
          "error" = COALESCE("error" || E'\n', '') || '[Reaper] Reset from stuck PROCESSING state'
      WHERE "status" = 'PROCESSING' AND "updatedAt" < ${staleThreshold} AND "attempts" < "maxAttempts"
    `;
    const reaperFailed = await prisma.$executeRaw`
      UPDATE "BackgroundJob"
      SET "status" = 'FAILED', "failedAt" = NOW(), "updatedAt" = NOW(),
          "error" = COALESCE("error" || E'\n', '') || '[Reaper] Permanently failed after exhausting retries in PROCESSING state'
      WHERE "status" = 'PROCESSING' AND "updatedAt" < ${staleThreshold} AND "attempts" >= "maxAttempts"
    `;

    const durationMs = Date.now() - startTime;
    console.log(`[CleanupJobsCron] Deleted ${deletedCount} old jobs | Reaper: recovered=${reaperRecovered} failed=${reaperFailed} | ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      deletedCount,
      reaperRecovered: Number(reaperRecovered),
      reaperFailed: Number(reaperFailed),
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