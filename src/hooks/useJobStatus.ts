"use client";

import { useEffect, useRef, useState } from "react";

export type JobStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface JobSnapshot {
  jobId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  result: any | null;
  error: string | null;
  completedAt: string | null;
  failedAt: string | null;
}

/**
 * Real-time job status hook with multi-layer reliability:
 *
 *   1. PRIMARY:   SSE stream from /api/jobs/{id}/stream
 *                 Sub-50 ms updates via Redis Pub/Sub. Server pushes the
 *                 initial snapshot immediately, then every lifecycle event.
 *
 *   2. FALLBACK:  Polls /api/jobs/{id} every 10 s as a self-heal in case
 *                 the SSE drops mid-job and EventSource auto-reconnect lags.
 *
 *   3. SHORT-CIRCUIT: When the job hits a terminal state (COMPLETED / FAILED)
 *                     both layers stop touching the network.
 *
 * Pass `null` to disable (e.g. before a job ID is known).
 */
export function useJobStatus(jobId: string | null) {
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset state when jobId changes
    setSnapshot(null);
    setConnected(false);

    if (!jobId) return;

    let cancelled = false;
    const isTerminal = (s: JobStatus | undefined) =>
      s === "COMPLETED" || s === "FAILED" || s === "CANCELLED";

    const applyEvent = (event: any) => {
      if (cancelled) return;
      setSnapshot((prev) => {
        if (event.type === "snapshot") {
          return {
            jobId: event.jobId,
            status: event.status,
            attempts: event.attempts,
            maxAttempts: event.maxAttempts,
            result: event.result ?? null,
            error: event.error ?? null,
            completedAt: event.completedAt ?? null,
            failedAt: event.failedAt ?? null,
          };
        }
        if (event.type === "job_running") {
          return {
            ...(prev ?? ({} as JobSnapshot)),
            jobId: event.jobId,
            status: "PROCESSING",
            attempts: event.attempt,
            maxAttempts: event.maxAttempts,
            result: null,
            error: null,
            completedAt: null,
            failedAt: null,
          };
        }
        if (event.type === "job_completed") {
          return {
            ...(prev ?? ({} as JobSnapshot)),
            jobId: event.jobId,
            status: "COMPLETED",
            result: event.result ?? null,
            error: null,
            completedAt: new Date().toISOString(),
            failedAt: null,
          };
        }
        if (event.type === "job_failed") {
          return {
            ...(prev ?? ({} as JobSnapshot)),
            jobId: event.jobId,
            status: "FAILED",
            error: event.error ?? "Unknown error",
            failedAt: new Date().toISOString(),
          };
        }
        return prev;
      });
    };

    // ── Polling fallback (also primes initial state quickly) ────────────
    const pollOnce = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data ?? json; // ApiResponse.success wraps in `data`
        applyEvent({
          type: "snapshot",
          jobId: data.id ?? jobId,
          status: data.status,
          attempts: data.attempts,
          maxAttempts: data.maxAttempts,
          result: data.result ?? null,
          error: data.error ?? null,
          completedAt: data.completedAt ?? null,
          failedAt: data.failedAt ?? null,
        });
        if (isTerminal(data.status)) stopPolling();
      } catch { /* swallow; SSE may still deliver */ }
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    // Run an immediate poll for the first paint, then every 10s as a safety net
    void pollOnce();
    pollTimerRef.current = setInterval(pollOnce, 10_000);

    // ── SSE primary path ────────────────────────────────────────────────
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        applyEvent(data);
        if (data.type === "job_completed" || data.type === "job_failed") {
          stopPolling();
          es.close();
        }
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects; polling fallback keeps us honest in
      // the meantime so we never miss a terminal transition.
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
      stopPolling();
    };
  }, [jobId]);

  return { snapshot, connected };
}
