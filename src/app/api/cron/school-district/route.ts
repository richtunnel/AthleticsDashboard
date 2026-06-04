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

  let succeeded = 0;
  let failed    = 0;

  for (const job of jobs) {
    // Mark as PROCESSING so concurrent runs skip it
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data:  { status: "PROCESSING", lastAttemptAt: new Date() },
    });

    const { userId, address } = job.payload as { userId: string; address: string };

    try {
      const district = await lookupSchoolDistrict(address, 8_000);

      if (district) {
        await prisma.user.update({
          where: { id: userId },
          data:  { schoolDistrict: district },
        });
      }

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data:  { status: "COMPLETED", completedAt: new Date(), attempts: { increment: 1 } },
      });
      succeeded++;
    } catch (err) {
      const attempts = (job.attempts ?? 0) + 1;
      const maxAttempts = job.maxAttempts ?? 5;
      const backoffMs   = Math.min(1_000 * 2 ** attempts, 3_600_000); // cap at 1 h

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data:  {
          status:         attempts >= maxAttempts ? "FAILED" : "PENDING",
          attempts:       attempts,
          error:          String(err),
          lastAttemptAt:  new Date(),
          failedAt:       attempts >= maxAttempts ? new Date() : undefined,
          nextAttemptAt:  attempts >= maxAttempts
            ? undefined
            : new Date(Date.now() + backoffMs),
        },
      });
      failed++;
    }
  }

  return NextResponse.json({ processed: jobs.length, succeeded, failed });
}
