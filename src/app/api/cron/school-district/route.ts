/**
 * GET /api/cron/school-district
 *
 * Processes pending SCHOOL_DISTRICT_LOOKUP BackgroundJob records.
 * Safe to call repeatedly — each job is marked PROCESSING before work begins
 * so concurrent cron invocations don't double-process.
 *
 * Triggered by Vercel Cron (add to vercel.json) or any scheduled call.
 * Also callable manually from Settings if needed.
 *
 * Processes up to 20 jobs per invocation to respect serverless limits.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { lookupSchoolDistrict } from "@/lib/utils/schoolDistrictLookup";

const BATCH = 20;

export async function GET() {
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      type:   "SCHOOL_DISTRICT_LOOKUP",
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
    },
    take: BATCH,
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Mark all jobs PROCESSING in one batch update before touching external API
  await prisma.backgroundJob.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data:  { status: "PROCESSING", lastAttemptAt: new Date() },
  });

  // Run all external lookups concurrently — each call has its own 8 s timeout
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const { userId, address } = job.payload as { userId: string; address: string };
      const district = await lookupSchoolDistrict(address, 8_000);
      return { jobId: job.id, userId, district, attempts: (job.attempts ?? 0) + 1, maxAttempts: job.maxAttempts ?? 5 };
    })
  );

  let succeeded = 0;
  let failed    = 0;

  // Batch the DB writes: collect user updates and job updates separately
  const userUpdates: Array<{ userId: string; district: string }> = [];
  const jobCompletions: string[] = [];
  const jobFailures: Array<{ id: string; attempts: number; maxAttempts: number; error: string }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const job    = jobs[i];

    if (result.status === "fulfilled") {
      const { userId, district } = result.value;
      if (district) userUpdates.push({ userId, district });
      jobCompletions.push(job.id);
      succeeded++;
    } else {
      const attempts    = (job.attempts ?? 0) + 1;
      const maxAttempts = job.maxAttempts ?? 5;
      jobFailures.push({ id: job.id, attempts, maxAttempts, error: String(result.reason) });
      failed++;
    }
  }

  // Batch user district updates in a transaction
  if (userUpdates.length > 0) {
    await prisma.$transaction(
      userUpdates.map(({ userId, district }) =>
        prisma.user.update({ where: { id: userId }, data: { schoolDistrict: district } })
      )
    );
  }

  // Batch job completions
  if (jobCompletions.length > 0) {
    await prisma.backgroundJob.updateMany({
      where: { id: { in: jobCompletions } },
      data:  { status: "COMPLETED", completedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  // Batch job failures (each has different backoff — must update individually)
  if (jobFailures.length > 0) {
    await prisma.$transaction(
      jobFailures.map(({ id, attempts, maxAttempts, error }) => {
        const backoffMs = Math.min(1_000 * 2 ** attempts, 3_600_000);
        return prisma.backgroundJob.update({
          where: { id },
          data:  {
            status:        attempts >= maxAttempts ? "FAILED" : "PENDING",
            attempts,
            error,
            lastAttemptAt: new Date(),
            failedAt:      attempts >= maxAttempts ? new Date() : undefined,
            nextAttemptAt: attempts >= maxAttempts ? undefined : new Date(Date.now() + backoffMs),
          },
        });
      })
    );
  }

  return NextResponse.json({ processed: jobs.length, succeeded, failed });
}
