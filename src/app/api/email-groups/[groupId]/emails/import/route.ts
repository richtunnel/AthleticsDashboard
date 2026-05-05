import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType, JobStatus } from "@prisma/client";
import { getEmailContactLimit } from "@/lib/security/plan-limits";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails at or below this threshold are inserted synchronously (no queue needed) */
const SYNC_THRESHOLD = 50;

function normalizeEmails(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const email = item.trim().toLowerCase();
    if (email && EMAIL_REGEX.test(email)) {
      seen.add(email);
    }
  }
  return Array.from(seen);
}

/**
 * POST /api/email-groups/[groupId]/emails/import
 *
 * Accepts { emails: string[] } in the request body.
 * - ≤ 50 emails: synchronous insert, returns { added, duplicates } immediately.
 * - > 50 emails: enqueues an EMAIL_IMPORT background job and returns { jobId }.
 *   One concurrent import job per group is enforced (backpressure).
 *   Contact limit is enforced per plan: Standard 5k / Team 10k / Plus 100k.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;

  if (!groupId) {
    return NextResponse.json({ error: "Group ID required" }, { status: 400 });
  }

  // Verify the group belongs to this organisation
  const group = await prisma.emailGroup.findFirst({
    where: { id: groupId, organizationId: session.user.organizationId },
    select: { id: true, name: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Email group not found" }, { status: 404 });
  }

  // Parse and validate the body
  let body: { emails?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.emails)) {
    return NextResponse.json({ error: "'emails' must be an array" }, { status: 400 });
  }

  const normalized = normalizeEmails(body.emails as string[]);

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid email addresses provided" }, { status: 400 });
  }

  // ─── Contact limit check ─────────────────────────────────────────────────
  const [contactLimit, currentContactCount] = await Promise.all([
    getEmailContactLimit(session.user.id),
    prisma.emailAddress.count({
      where: {
        group: { organizationId: session.user.organizationId },
      },
    }),
  ]);

  const isLimitFinite = isFinite(contactLimit);
  const available = isLimitFinite ? Math.max(0, contactLimit - currentContactCount) : Infinity;

  if (isLimitFinite && currentContactCount >= contactLimit) {
    return NextResponse.json(
      {
        error: `You have reached your plan's email contact limit of ${contactLimit.toLocaleString()} contacts. Please upgrade your plan to import more emails.`,
        limitExceeded: true,
        contactLimit,
        currentContactCount,
      },
      { status: 403 }
    );
  }

  // Clamp the import to what's available under the plan
  const emailsToImport = isLimitFinite ? normalized.slice(0, available) : normalized;
  const clampedCount = normalized.length - emailsToImport.length;

  // ─── Small batch: handle synchronously ───────────────────────────────────
  if (emailsToImport.length <= SYNC_THRESHOLD) {
    const existing = await prisma.emailAddress.findMany({
      where: { groupId, email: { in: emailsToImport } },
      select: { email: true },
    });

    const existingSet = new Set(existing.map((e) => e.email));
    const newEmails = emailsToImport.filter((e) => !existingSet.has(e));

    if (newEmails.length > 0) {
      await prisma.emailAddress.createMany({
        data: newEmails.map((email) => ({ email, groupId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      mode: "sync",
      added: newEmails.length,
      duplicates: emailsToImport.length - newEmails.length,
      clamped: clampedCount,
      contactLimit: isLimitFinite ? contactLimit : null,
      currentContactCount: currentContactCount + newEmails.length,
    });
  }

  // ─── Large batch: enqueue background job ─────────────────────────────────

  // Backpressure: only 1 active EMAIL_IMPORT job per group at a time
  const activeJob = await prisma.backgroundJob.findFirst({
    where: {
      type: JobType.EMAIL_IMPORT,
      status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] },
      payload: { path: ["groupId"], equals: groupId },
    },
    select: { id: true, status: true },
  });

  if (activeJob) {
    return NextResponse.json(
      {
        error: "An import is already in progress for this group. Please wait for it to complete.",
        jobId: activeJob.id,
      },
      { status: 429 }
    );
  }

  const job = await jobQueueService.enqueue({
    type: JobType.EMAIL_IMPORT,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    maxAttempts: 3,
    payload: {
      groupId,
      userId: session.user.id,
      organizationId: session.user.organizationId,
      emails: emailsToImport,
    },
  });

  return NextResponse.json(
    {
      mode: "async",
      jobId: job.id,
      total: emailsToImport.length,
      clamped: clampedCount,
      contactLimit: isLimitFinite ? contactLimit : null,
    },
    { status: 202 }
  );
}

/**
 * GET /api/email-groups/[groupId]/emails/import?jobId=xxx
 *
 * Poll for the status of an async import job.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId: _groupId } = await params;
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId query parameter required" }, { status: 400 });
  }

  const job = await jobQueueService.getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Scope check — job must belong to caller's organisation
  const raw = await prisma.backgroundJob.findUnique({
    where: { id: jobId },
    select: { organizationId: true },
  });

  if (raw?.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
}
