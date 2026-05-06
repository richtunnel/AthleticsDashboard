"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegistration
 *
 * Registers /service-worker.js (v2) and wires up:
 *  - Update detection: when a new SW is waiting, post SKIP_WAITING so it
 *    activates without the user having to close all tabs (Principle 6).
 *  - Notification permission: politely requests permission once so desktop
 *    chat notifications can be shown via the SW.
 *
 * Runs in production only. The app works fully without it (Principle 5).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/service-worker.js",
          { scope: "/" }
        );

        // ----------------------------------------------------------------
        // Update handling (Principle 6: explicit coordination via postMessage)
        // When a new SW finishes installing and is waiting, tell it to
        // skip waiting immediately so users get the new version without
        // needing to close all tabs.
        // ----------------------------------------------------------------
        const activateWaiting = (sw: ServiceWorker) => {
          sw.postMessage({ type: "SKIP_WAITING" });
        };

        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.onstatechange = () => {
            if (installing.state === "installed") {
              if (navigator.serviceWorker.controller) {
                // There's already a controller — a new update is waiting
                console.log("[SW] New version waiting — activating");
                activateWaiting(installing);
              }
              // No prior controller = first install; nothing to do
            }
          };
        };

        // If a SW is already waiting when the page loads, activate it now
        if (registration.waiting) {
          activateWaiting(registration.waiting);
        }

        // ----------------------------------------------------------------
        // Reload when the controller changes (new SW took over)
        // ----------------------------------------------------------------
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });

        // ----------------------------------------------------------------
        // Periodic update check every 6 hours
        // ----------------------------------------------------------------
        updateCheckInterval = setInterval(() => {
          registration.update().catch(() => {
            // Network may be offline; ignore
          });
        }, 6 * 60 * 60 * 1000);

        // ----------------------------------------------------------------
        // Notification permission (Principle 5: graceful fallback)
        // Only request if the API is available and not yet decided.
        // ----------------------------------------------------------------
        if ("Notification" in window && Notification.permission === "default") {
          // Small delay so we don't pop a permission dialog on page load
          setTimeout(() => {
            Notification.requestPermission().catch(() => {
              // Permission request failed or was blocked by browser policy
            });
          }, 5_000);
        }
      } catch (error) {
        // SW registration failed — app continues without offline / notification support
        console.warn("[SW] Registration failed:", error);
      }
    };

    register();

    return () => {
      if (updateCheckInterval) clearInterval(updateCheckInterval);
    };
  }, []);

  return null;
}
