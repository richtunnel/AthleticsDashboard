import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";
import { subscribeChatChannel } from "@/lib/chat/eventBus";

/**
 * GET /api/jobs/[id]/stream
 *
 * Server-Sent Events feed of lifecycle updates for a single BackgroundJob.
 *
 * Push delivery: the worker publishes to Redis channel `syncjob:{id}` on
 * every state transition (running, progress, completed, failed). This SSE
 * route subscribes to that channel and forwards each event to the client.
 *
 * No polling. Real-time updates land in the browser within ~50 ms of the
 * worker emitting them, fanned out via Redis Pub/Sub to every connected
 * container/process. If Redis is disabled the same channel is delivered via
 * the in-process EventEmitter fallback (single-container deployments).
 *
 * The client should ALSO keep a fallback polling timer on the polling
 * endpoint (`GET /api/jobs/[id]`) at ~10s cadence so it self-heals if the
 * SSE connection drops mid-job.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth (parent OR AD/collaborator)
  let userId: string | null = null;
  let organizationId: string | null = null;
  try {
    const s = await requireAuth();
    userId = s.user.id;
    organizationId = s.user.organizationId ?? null;
  } catch {
    const p = await getParentSession();
    if (p?.user?.email) {
      const u = await prisma.user.findUnique({
        where: { email: p.user.email },
        select: { id: true, organizationId: true },
      });
      if (u) {
        userId = u.id;
        organizationId = u.organizationId;
      }
    }
  }
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  // Ensure the caller is allowed to see this job
  const job = await prisma.backgroundJob.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      userId: true,
      organizationId: true,
      result: true,
      error: true,
      attempts: true,
      maxAttempts: true,
      completedAt: true,
      failedAt: true,
    },
  });
  if (!job) return new Response("Job not found", { status: 404 });

  const isOwner = job.userId === userId;
  const isOrgStaff =
    job.organizationId != null && job.organizationId === organizationId;
  if (!isOwner && !isOrgStaff) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Build the SSE stream ──────────────────────────────────────────────
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // 1. Immediately send the current job state so a client connecting
      //    after the job completed still gets the final outcome.
      send({
        type: "snapshot",
        jobId: job.id,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        result: job.result ?? null,
        error: job.error ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        failedAt: job.failedAt?.toISOString() ?? null,
      });

      // 2. If the job is already in a terminal state, close the stream
      //    cleanly — nothing more will ever be published for it.
      if (job.status === "COMPLETED" || job.status === "FAILED") {
        try { controller.close(); } catch { /* ignore */ }
        return;
      }

      // 3. Otherwise subscribe to lifecycle events the worker publishes.
      const unsubscribe = subscribeChatChannel(`syncjob:${id}`, (event) => {
        send(event);
        // Close on terminal events so the client knows to stop listening
        if (event?.type === "job_completed" || event?.type === "job_failed") {
          closed = true;
          unsubscribe();
          try { controller.close(); } catch { /* ignore */ }
        }
      });

      // 4. Keepalive every 25 s — survives any reverse-proxy idle timeout
      const keepalive = setInterval(() => {
        if (closed) { clearInterval(keepalive); return; }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
          clearInterval(keepalive);
        }
      }, 25_000);

      // 5. Hard ceiling — never hold the stream open longer than 10 min.
      //    Forces the client to reconnect (which it does automatically) and
      //    prevents zombie connections from accumulating on the server.
      const hardLimit = setTimeout(() => {
        closed = true;
        unsubscribe();
        clearInterval(keepalive);
        try { controller.close(); } catch { /* ignore */ }
      }, 10 * 60_000);

      // 6. Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        closed = true;
        unsubscribe();
        clearInterval(keepalive);
        clearTimeout(hardLimit);
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
