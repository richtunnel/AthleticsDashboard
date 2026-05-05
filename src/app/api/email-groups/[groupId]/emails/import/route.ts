import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { jobQueueService } from "@/lib/services/job-queue.service";
import { JobType, JobStatus } from "@prisma/client";
import { emailImportService } from "@/lib/services/email-import.service";

/** Emails at or below this threshold are inserted synchronously (no queue needed) */
const SYNC_THRESHOLD = 100;

/**
 * POST /api/email-groups/[groupId]/emails/import
 *
 * Supports JSON body: { emails: string[] }
 * Supports Multipart/Form-Data: file upload (.csv, .txt)
 *
 * - ≤ SYNC_THRESHOLD emails: synchronous insert
 * - > SYNC_THRESHOLD emails: enqueues an EMAIL_IMPORT background job
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

  let rawEmails: string[] = [];
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (Array.isArray(body.emails)) {
        rawEmails = body.emails;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      if (file) {
        const text = await file.text();
        // Use the same normalization logic as the service to extract emails from text
        rawEmails = text.split(/[\n,;]/);
      }
    }
  } catch (error) {
    console.error("Error parsing import request:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const normalized = emailImportService.normalizeEmails(rawEmails);

  if (normalized.length === 0) {
    return NextResponse.json({ error: "No valid email addresses provided" }, { status: 400 });
  }

  // ─── Small batch: handle synchronously ───────────────────────────────────
  if (normalized.length <= SYNC_THRESHOLD) {
    try {
      const result = await emailImportService.processImportJob({
        groupId,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        emails: normalized,
      });

      return NextResponse.json({
        mode: "sync",
        ...result,
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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
      { status: 429 },
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
      emails: normalized,
    },
  });

  return NextResponse.json(
    {
      mode: "async",
      jobId: job.id,
      total: normalized.length,
    },
    { status: 202 },
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
