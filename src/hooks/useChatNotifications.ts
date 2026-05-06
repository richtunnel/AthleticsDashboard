"use client";

import { useEffect, useRef, useCallback } from "react";
import { useNotifications } from "@/contexts/NotificationContext";

/**
 * useChatNotifications
 *
 * Opens a Server-Sent Events connection to receive real-time chat events for
 * the authenticated user and surfaces them in two ways:
 *
 *   1. Dashboard bell (existing) — addNotification() as before.
 *   2. Desktop notification (new) — shown via the Service Worker when the
 *      browser grants Notification permission.  Works while the tab is open
 *      but minimised / in the background.  Falls back silently if SW or
 *      permission is unavailable (Principle 5: graceful fallback).
 *
 * @param streamUrl - The SSE endpoint URL (e.g. "/api/chat/notifications/stream")
 */
export function useChatNotifications(streamUrl: string) {
  const { addNotification } = useNotifications();
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // -------------------------------------------------------------------------
  // Show a desktop notification via the Service Worker (Principle 5)
  // -------------------------------------------------------------------------
  const showDesktopNotification = useCallback(
    async (title: string, body: string, conversationId?: string) => {
      try {
        // Guard: permission must be granted
        if (!("Notification" in window) || Notification.permission !== "granted") {
          return;
        }

        // Guard: SW must be available and controlling the page
        if (!("serviceWorker" in navigator)) return;

        const registration = await navigator.serviceWorker.ready;
        if (!registration) return;

        // Principle 4 (idempotent): tag deduplicates if multiple arrive quickly
        await registration.showNotification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: conversationId ? `chat-${conversationId}` : "chat",
          renotify: true, // ring again even if same tag already shown
          data: {
            url: conversationId
              ? `/dashboard/messages?conversation=${conversationId}`
              : "/dashboard/messages",
          },
        });
      } catch {
        // Desktop notifications are best-effort; never let them crash the hook
      }
    },
    []
  );

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Close any existing connection before opening a new one
    closeConnection();

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Store the current user's ID from the connected event
        if (data.type === "connected") {
          currentUserIdRef.current = data.userId;
          return;
        }

        // Skip notifications for messages sent by the current user
        if (data.senderUserId === currentUserIdRef.current) {
          return;
        }

        // Truncate long message previews
        const preview =
          data.content?.length > 50
            ? data.content.substring(0, 50) + "..."
            : data.content || "";

        const senderLabel = data.senderName || "someone";

        // ── 1. Dashboard bell (existing behaviour) ───────────────────────
        addNotification(
          `New message from ${senderLabel}: ${preview}`,
          "info"
        );

        // ── 2. Desktop notification via Service Worker (new) ─────────────
        showDesktopNotification(
          `New message from ${senderLabel}`,
          preview,
          data.conversationId
        );
      } catch (err) {
        console.error("[ChatNotifications] Failed to parse event:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects on error
      console.warn("[ChatNotifications] Connection error, will auto-reconnect...");
    };

    return () => {
      closeConnection();
    };
  }, [streamUrl, addNotification, closeConnection, showDesktopNotification]);

  return { closeConnection };
}
