import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { jobWorker } from "@/lib/services/job-worker.service";
import { JobStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maximum runtime for a single cron invocation (leaving buffer for cleanup)
const MAX_RUNTIME_MS = 55000;

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
  
  console.log("[JobWorkerCron] Starting job processing...");

  try {
    // Run the worker for the configured time
    const result = await jobWorker.run(MAX_RUNTIME_MS);

    const durationMs = Date.now() - startTime;
    
    // Log summary
    console.log(`[JobWorkerCron] Completed in ${durationMs}ms. Processed: ${result.processed}, Errors: ${result.errors}`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[JobWorkerCron] Worker error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

// Optional: GET endpoint to check worker status
export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const providedSecret = extractSecret(req);
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get queue statistics
  const [pendingCount, processingCount, completedCount, failedCount] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: JobStatus.PENDING } }),
    prisma.backgroundJob.count({ where: { status: JobStatus.PROCESSING } }),
    prisma.backgroundJob.count({ where: { status: JobStatus.COMPLETED } }),
    prisma.backgroundJob.count({ where: { status: JobStatus.FAILED } }),
  ]);

  // Get recent failures for monitoring
  const recentFailures = await prisma.backgroundJob.findMany({
    where: {
      status: JobStatus.FAILED,
      failedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      type: true,
      error: true,
      attempts: true,
      failedAt: true,
    },
    orderBy: { failedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    queue: {
      pending: pendingCount,
      processing: processingCount,
      completed: completedCount,
      failed: failedCount,
    },
    recentFailures,
    timestamp: new Date().toISOString(),
  });
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