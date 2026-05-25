"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TipId } from "@/components/tips/tipIds";

/**
 * TipsContext
 *
 * Single source of truth for which onboarding TipBubbles the user has
 * dismissed. Loads `dismissedTips` once via TanStack Query (cached for the
 * session) and exposes:
 *
 *   - isDismissed(tipId)  — synchronous check (every TipBubble uses this to
 *                           decide whether to render). Returns `true` while
 *                           the initial query is loading so we never flash a
 *                           tip the user has already dismissed.
 *   - dismiss(tipId)      — fire-and-forget. Optimistically marks the tip as
 *                           dismissed, then POSTs to the server. If the
 *                           request fails the optimistic write rolls back.
 *   - reset()             — clears every dismissal (used by Settings → Other).
 *
 * The Provider is mounted twice — once in the AD DashboardLayoutClient and
 * once in the ParentDashboardLayout. Each mount uses a different `apiBase`
 * because AD and parent sessions use different cookies, so the API needs to
 * be reached through a session-appropriate endpoint:
 *
 *   - AD     → /api/user/tips     (auth via requireAuth / main NextAuth cookie)
 *   - Parent → /api/parent/tips   (auth via getParentSession / parent cookie)
 *
 * The persisted `dismissedTips` array lives on the same User row regardless —
 * a user who is both AD and parent would share dismissals across both
 * dashboards, which is the desired behaviour.
 */

interface TipsContextValue {
  isDismissed: (tipId: TipId) => boolean;
  /** True until the initial fetch finishes — TipBubbles defer rendering. */
  isLoading: boolean;
  dismiss: (tipId: TipId) => void;
  reset: () => Promise<void>;
  // ── Display queue ────────────────────────────────────────────────────────
  // Only one TipBubble shows per page at a time. Each bubble registers a
  // slot when it's eligible (mounted, not dismissed, anchor present); the
  // provider exposes the head-of-queue tipId as `activeTipId`. Bubbles
  // render their popper only when `activeTipId === their tipId`, so they
  // appear sequentially instead of stacking on top of each other.
  /** Add this tip to the queue. Idempotent. */
  requestSlot: (tipId: string) => void;
  /** Remove this tip from the queue. Idempotent. */
  releaseSlot: (tipId: string) => void;
  /** The tipId currently allowed to render, or null if the queue is empty. */
  activeTipId: string | null;

  // ── Session-only hide (survives component remounts) ──────────────────────
  // Set by the X button / click-away. Persists for the lifetime of the
  // page session (until full reload) so that re-renders or temporary
  // unmount-remount cycles of the TipBubble don't cause it to pop back.
  // Not written to the server — the tip returns on the next page load,
  // unlike `dismiss(tipId)` which is permanent.
  sessionHide: (tipId: string) => void;
  isSessionHidden: (tipId: string) => boolean;
}

const TipsContext = createContext<TipsContextValue | null>(null);

interface TipsApiResponse {
  dismissed: string[];
}

interface TipsProviderProps {
  children: ReactNode;
  /** API base for tip endpoints — "/api/user/tips" (AD) or "/api/parent/tips" (parent). */
  apiBase?: string;
}

export function TipsProvider({ children, apiBase = "/api/user/tips" }: TipsProviderProps) {
  const queryClient = useQueryClient();

  // Cache key includes the apiBase so AD and parent caches don't collide if
  // both providers ever mount in the same tree (they won't in practice, but
  // this keeps the data model bullet-proof).
  const queryKey = useMemo(() => ["userTips", apiBase] as const, [apiBase]);

  const fetchTips = useCallback(async (): Promise<TipsApiResponse> => {
    const res = await fetch(apiBase);
    if (!res.ok) throw new Error("Failed to fetch tips");
    return res.json();
  }, [apiBase]);

  const postDismiss = useCallback(
    async (tipId: string): Promise<TipsApiResponse> => {
      const res = await fetch(`${apiBase}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipId }),
      });
      if (!res.ok) throw new Error("Failed to dismiss tip");
      return res.json();
    },
    [apiBase],
  );

  const postReset = useCallback(async (): Promise<TipsApiResponse> => {
    const res = await fetch(`${apiBase}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to reset tips");
    return res.json();
  }, [apiBase]);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: fetchTips,
    // Tips state changes rarely; keep it fresh for the session and don't
    // refetch on focus to avoid re-renders that could remount TipBubbles.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const dismissedSet = useMemo(() => new Set<string>(data?.dismissed ?? []), [data?.dismissed]);

  const dismissMutation = useMutation({
    mutationFn: postDismiss,
    // Optimistic: write to cache immediately so the bubble disappears on click
    // even before the network round-trip completes.
    onMutate: async (tipId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TipsApiResponse>(queryKey);
      queryClient.setQueryData<TipsApiResponse>(queryKey, (old) => {
        const current = old?.dismissed ?? [];
        if (current.includes(tipId)) return old ?? { dismissed: current };
        return { dismissed: [...current, tipId] };
      });
      return { previous };
    },
    onError: (_err, _tipId, ctx) => {
      // Roll back so the bubble re-appears if the dismiss really failed —
      // server is the source of truth.
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
    onSuccess: (server) => {
      queryClient.setQueryData<TipsApiResponse>(queryKey, server);
    },
  });

  const isDismissed = useCallback(
    (tipId: TipId) => {
      // While loading, treat every tip as dismissed. This prevents a flash
      // of an already-dismissed tip before the cache hydrates.
      if (isLoading) return true;
      return dismissedSet.has(tipId);
    },
    [dismissedSet, isLoading],
  );

  const dismiss = useCallback(
    (tipId: TipId) => {
      if (dismissedSet.has(tipId)) return;
      dismissMutation.mutate(tipId);
    },
    [dismissMutation, dismissedSet],
  );

  const reset = useCallback(async () => {
    const server = await postReset();
    queryClient.setQueryData<TipsApiResponse>(queryKey, server);
  }, [queryClient, queryKey, postReset]);

  // ── Queue: serialise concurrent TipBubbles so they show one-at-a-time ────
  // The queue is held in state (so consumers re-render when the head changes)
  // *and* mirrored in a ref so the request/release callbacks themselves can
  // stay reference-stable. Without that ref, every queue change would change
  // the callback identity and re-fire every TipBubble's registration effect,
  // which would in turn enqueue/dequeue forever.
  const [queue, setQueue] = useState<string[]>([]);
  const queueRef = useRef<string[]>([]);
  queueRef.current = queue;

  const requestSlot = useCallback((tipId: string) => {
    if (queueRef.current.includes(tipId)) return;
    setQueue((q) => (q.includes(tipId) ? q : [...q, tipId]));
  }, []);

  const releaseSlot = useCallback((tipId: string) => {
    if (!queueRef.current.includes(tipId)) return;
    setQueue((q) => q.filter((id) => id !== tipId));
  }, []);

  const activeTipId = queue[0] ?? null;

  // ── Session-only hide set ────────────────────────────────────────────────
  // Mirror via ref so the action callbacks stay reference-stable. Mirror via
  // state so `isSessionHidden(tipId)` is reactive — consumers re-render when
  // a tip flips from visible to hidden.
  const [sessionHiddenSet, setSessionHiddenSet] = useState<Set<string>>(() => new Set());
  const sessionHiddenRef = useRef<Set<string>>(sessionHiddenSet);
  sessionHiddenRef.current = sessionHiddenSet;

  const sessionHide = useCallback((tipId: string) => {
    if (sessionHiddenRef.current.has(tipId)) return;
    setSessionHiddenSet((prev) => {
      if (prev.has(tipId)) return prev;
      const next = new Set(prev);
      next.add(tipId);
      return next;
    });
  }, []);

  const isSessionHidden = useCallback((tipId: string) => sessionHiddenSet.has(tipId), [sessionHiddenSet]);

  const value = useMemo<TipsContextValue>(
    () => ({
      isDismissed,
      isLoading,
      dismiss,
      reset,
      requestSlot,
      releaseSlot,
      activeTipId,
      sessionHide,
      isSessionHidden,
    }),
    [isDismissed, isLoading, dismiss, reset, requestSlot, releaseSlot, activeTipId, sessionHide, isSessionHidden],
  );

  return <TipsContext.Provider value={value}>{children}</TipsContext.Provider>;
}

export function useTips(): TipsContextValue {
  const ctx = useContext(TipsContext);
  if (!ctx) {
    // Render a safe no-op so a TipBubble accidentally placed outside the
    // provider never crashes the page — it just doesn't show.
    return {
      isDismissed: () => true,
      isLoading: true,
      dismiss: () => {},
      reset: async () => {},
      requestSlot: () => {},
      releaseSlot: () => {},
      activeTipId: null,
      sessionHide: () => {},
      isSessionHidden: () => true, // Default to true outside context to prevent accidental renders
    };
  }
  return ctx;
}
