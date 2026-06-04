"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Drop-in replacement for useState(0) for MUI tab components.
 *
 * SSR-safe: always renders tab=0 on the server (matching the client's first
 * paint) then corrects to the localStorage value in a post-mount useEffect,
 * avoiding the "hydration mismatch" error caused by reading localStorage
 * inside a useState initializer.
 *
 * URL `?tab=` overrides localStorage on mount (for deep-links like the
 * Game Center pill → Game Requests tab).
 */
export function usePersistedTab(
  storageKey: string,
  max: number,
  urlOverride?: number
): [number, (v: number) => void] {
  // Always start at 0 on both server and client — avoids hydration mismatch.
  const [tab, setTabState] = useState(0);

  // After mount (client-only), apply the URL override or the stored value.
  useEffect(() => {
    let initial = 0;

    if (urlOverride !== undefined && !isNaN(urlOverride)) {
      initial = Math.min(Math.max(0, urlOverride), max);
    } else {
      try {
        const stored = localStorage.getItem(storageKey);
        const parsed = parseInt(stored ?? "", 10);
        if (!isNaN(parsed)) initial = Math.min(Math.max(0, parsed), max);
      } catch { /* private browsing or storage quota — ignore */ }
    }

    if (initial !== 0) setTabState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  const setTab = useCallback(
    (v: number) => {
      const clamped = Math.min(Math.max(0, v), max);
      setTabState(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch { /* ignore */ }
    },
    [storageKey, max]
  );

  return [tab, setTab];
}
