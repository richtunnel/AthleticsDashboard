import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { z } from "zod";
import { JobType, JobStatus } from "@prisma/client";
import crypto from "crypto";

const syncSchema = z.object({
  googleCalendarId: z.string().min(1, "Calendar ID is required"),
  /**
   * Optional client-supplied idempotency token. When provided AND a job with
   * the same token is still QUEUED / PROCESSING (or completed within the
   * last 60s), we return the existing job instead of creating a duplicate.
   * The client should generate one UUID per user-initiated sync attempt.
   */
  idempotencyToken: z.string().min(8).max(128).optional(),
});

/**
 * POST /api/parent/calendar-sync-requests/[id]/sync
 *
 * Kicks off a Google Calendar push for an approved sync request.
 *
 * This route is NON-BLOCKING — it enqueues a BullMQ job and returns the
 * job ID immediately. The actual game pushes (potentially slow, can fail
 * transiently against the Google Calendar API) happen on a worker with
 * built-in retry + exponential backoff.
 *
 * Response shape:
 *   { jobId, status, idempotencyToken }
 *
 * The client should:
 *   1. Subscribe to `GET /api/jobs/{jobId}/stream` (SSE) for real-time progress
 *   2. Fall back to polling `GET /api/jobs/{jobId}` if SSE fails
 *   3. Reuse `idempotencyToken` on retries to avoid duplicate pushes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const sessionUserId = (session.user as any).id as string | undefined;
    const user = sessionUserId
      ? await prisma.user.findUnique({ where: { id: sessionUserId } })
      : await prisma.user.findFirst({
          where: { email: { equals: session.user.email, mode: "insensitive" } },
        });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = syncSchema.parse(body);
    const googleCalendarId = parsed.googleCalendarId;
    const token = parsed.idempotencyToken ?? crypto.randomUUID();

    // ── Verify the sync request belongs to this parent and is APPROVED ───
    const syncRequest = await prisma.calendarSyncRequest.findUnique({
      where: { id },
    });
    if (!syncRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (syncRequest.parentUserId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (syncRequest.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved requests can be synced" },
        { status: 400 }
      );
    }

    // ── Idempotency: dedupe by token within a rolling 60-second window ───
    // BackgroundJob stores the token inside the JSON payload. We match on
    // that path + recency so two clicks 200 ms apart return the same job
    // but a fresh attempt 5 minutes later starts a new one.
    const sixtySecondsAgo = new Date(Date.now() - 60_000);
    const existing = await prisma.backgroundJob.findFirst({
      where: {
        type: JobType.CALENDAR_SYNC,
        payload: { path: ["token"], equals: token },
        OR: [
          { status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } },
          { completedAt: { gte: sixtySecondsAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return NextResponse.json({
        jobId: existing.id,
        status: existing.status,
        idempotencyToken: token,
        deduped: true,
      });
    }

    // ── Persist the chosen calendar on the CalendarSyncRequest IMMEDIATELY ─
    // The worker also does this on completion, but persisting up front means
    // a follow-up "Update Sync" click (before the first job finishes) won't
    // re-prompt the parent to pick a calendar. Only write when the value
    // actually changed to avoid no-op updates.
    if (syncRequest.googleCalendarId !== googleCalendarId) {
      await prisma.calendarSyncRequest
        .update({
          where: { id: syncRequest.id },
          data: { googleCalendarId },
        })
        .catch((err) => {
          console.error("[parent-sync] failed to persist googleCalendarId early:", err);
        });
    }

    // ── Create the BackgroundJob row (canonical record) ───────────────────
    const backgroundJob = await prisma.backgroundJob.create({
      data: {
        type: JobType.CALENDAR_SYNC,
        status: JobStatus.PENDING,
        userId: user.id,
        organizationId: syncRequest.schoolId,
        maxAttempts: 5,
        payload: {
          token,
          kind: "parent-sport-sync",
          syncRequestId: syncRequest.id,
          schoolId: syncRequest.schoolId,
          sportName: syncRequest.sportName,
          sportLevel: syncRequest.sportLevel,
          googleCalendarId,
          workbookId: syncRequest.workbookId ?? null,
          gender: syncRequest.gender ?? null,
        },
      },
    });

    // ── Enqueue on the parent-scoped BullMQ queue ─────────────────────────
    // When Redis is up: enqueue and let the worker push games asynchronously.
    // When Redis is down: fall back to running the work inline. The parent
    // gets a slightly slower response but the sync still happens — beats the
    // old behaviour where the route 503'd and nothing synced at all.
    const { REDIS_ENABLED } = await import("@/lib/queue/connection");
    let enqueued = false;

    if (REDIS_ENABLED) {
      try {
        const { parentCalendarSyncQueue } = await import("@/lib/queue/queues");
        await parentCalendarSyncQueue.add(
          "sync",
          {
            backgroundJobId: backgroundJob.id,
            token,
            parentUserId: user.id,
            syncRequestId: syncRequest.id,
            schoolId: syncRequest.schoolId,
            sportName: syncRequest.sportName,
            sportLevel: syncRequest.sportLevel,
            googleCalendarId,
            workbookId: syncRequest.workbookId ?? null,
            gender: syncRequest.gender ?? null,
          },
          {
            // Make BullMQ dedupe within the same minute as belt-and-suspenders
            // on top of our DB-level check above.
            jobId: `parent-sync:${token}`,
          }
        );
        enqueued = true;
      } catch (err) {
        console.error("[parent-sync] enqueue failed, falling back to inline run:", err);
      }
    }

    if (!enqueued) {
      // ── Inline fallback path ────────────────────────────────────────────
      // Run the same work the worker does, but synchronously in this request.
      // Mirrors workers/parent-calendar-sync.worker.ts so the BackgroundJob
      // row + ConnectedParent + sync request stay consistent with the
      // queued path.
      try {
        await prisma.backgroundJob
          .update({
            where: { id: backgroundJob.id },
            data: { status: JobStatus.PROCESSING, lastAttemptAt: new Date() },
          })
          .catch(() => {});

        const { calendarService } = await import("@/lib/services/calendar.service");
        const results = await calendarService.syncGamesForSportLevel(
          user.id,
          syncRequest.schoolId,
          syncRequest.sportName,
          syncRequest.sportLevel,
          googleCalendarId,
          syncRequest.workbookId ?? null,
          syncRequest.gender ?? null
        );

        const added = results.filter((r: any) => r.ok).length;
        const failed = results.filter((r: any) => !r.ok).length;
        const firstError = results.find((r: any) => !r.ok)?.error ?? null;
        const result = { added, failed, firstError };

        if (added === 0 && failed > 0) {
          await prisma.backgroundJob
            .update({
              where: { id: backgroundJob.id },
              data: {
                status: JobStatus.FAILED,
                failedAt: new Date(),
                error: (firstError ?? "All game pushes failed").slice(0, 500),
              },
            })
            .catch(() => {});
          return NextResponse.json(
            { error: firstError ?? "Failed to sync games to your calendar" },
            { status: 500 }
          );
        }

        await prisma.backgroundJob
          .update({
            where: { id: backgroundJob.id },
            data: { status: JobStatus.COMPLETED, completedAt: new Date(), result },
          })
          .catch(() => {});

        await prisma.connectedParent
          .updateMany({
            where: { parentUserId: user.id, schoolId: syncRequest.schoolId },
            data: { calendarSynced: true, lastSyncedAt: new Date() },
          })
          .catch(() => {});

        // Persist the chosen calendar (matches what the worker does on success)
        if (syncRequest.googleCalendarId !== googleCalendarId) {
          await prisma.calendarSyncRequest
            .update({ where: { id: syncRequest.id }, data: { googleCalendarId } })
            .catch(() => {});
        }

        return NextResponse.json({
          jobId: backgroundJob.id,
          status: JobStatus.COMPLETED,
          idempotencyToken: token,
          deduped: false,
          result,
        });
      } catch (err: any) {
        console.error("[parent-sync] inline run failed:", err);
        await prisma.backgroundJob
          .update({
            where: { id: backgroundJob.id },
            data: {
              status: JobStatus.FAILED,
              failedAt: new Date(),
              error: (err?.message || "Sync failed").slice(0, 500),
            },
          })
          .catch(() => {});
        return NextResponse.json(
          { error: err?.message || "Failed to sync games to your calendar" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      jobId: backgroundJob.id,
      status: backgroundJob.status,
      idempotencyToken: token,
      deduped: false,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[API] Error enqueuing sync:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to start sync" },
      { status: 500 }
    );
  }
}
