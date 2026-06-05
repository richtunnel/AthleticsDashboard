"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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
          renotify: true, // ring again even if same tag already shown (TS type gap, valid browser API)
          data: {
            url: conversationId
              ? `/dashboard/messages?conversation=${conversationId}`
              : "/dashboard/messages",
          },
        } as NotificationOptions);
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

        // ── Calendar sync request notification ───────────────────────────
        // Two event shapes flow through here:
        //   • type === "sync_request"          → a NEW pending request arrived
        //   • type === "sync_request_updated"  → an existing request was
        //                                         approved/rejected by another tab
        // Both invalidate the same queries so every AD tab refreshes in
        // real-time without polling. The toast + desktop notification only
        // fires for new requests.
        if (data.type === "sync_request" || data.type === "sync_request_updated") {
          queryClient.invalidateQueries({ queryKey: ["adminCalendarSyncRequests"] });
          queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
          queryClient.invalidateQueries({ queryKey: ["chatConversations"] });

          if (data.type === "sync_request") {
            const label = `${data.sportName} ${data.sportLevel}`;
            addNotification(
              `${data.parentName} requested calendar sync for ${label}`,
              "info"
            );
            showDesktopNotification(
              "Calendar Sync Request",
              `${data.parentName} requested calendar sync for ${label}`
            );
          }
          return;
        }

        // ── Game Request notifications ────────────────────────────────────
        if (data.type === "GAME_REQUEST_RECEIVED") {
          queryClient.invalidateQueries({ queryKey: ["game-requests"] });
          queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
          addNotification("You have a new game request!", "info");
          showDesktopNotification("New Game Request", "Another AD would like to schedule a game with you.");
          return;
        }
        if (data.type === "GAME_REQUEST_APPROVED") {
          queryClient.invalidateQueries({ queryKey: ["game-requests"] });
          queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
          addNotification("Your game request was approved! Log in to confirm.", "success");
          showDesktopNotification("Game Request Approved", "Your game request has been approved.");
          return;
        }
        if (data.type === "GAME_REQUEST_REJECTED") {
          queryClient.invalidateQueries({ queryKey: ["game-requests"] });
          addNotification("Your game request was declined.", "warning");
          return;
        }
        if (data.type === "GAME_REQUEST_CONFIRMED") {
          queryClient.invalidateQueries({ queryKey: ["game-requests"] });
          addNotification("A game has been confirmed!", "success");
          return;
        }

        // ── AD Chat notifications ─────────────────────────────────────────
        if (data.type === "ad_message") {
          queryClient.invalidateQueries({ queryKey: ["adChatConversations"] });
          queryClient.invalidateQueries({ queryKey: ["adChatUnread"] });
          const preview = data.content?.length > 50 ? data.content.substring(0, 50) + "..." : (data.content || "");
          const label   = data.senderName || "An AD";
          addNotification(`New message from ${label}: ${preview}`, "info");
          showDesktopNotification(`New message from ${label}`, preview, data.conversationId);
          return;
        }
        if (data.type === "GAME_REQUEST_COUNT_UPDATE") {
          queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
          return;
        }
        if (data.type === "SCHEDULE_POST_UPDATED") {
          queryClient.invalidateQueries({ queryKey: ["schedule-board"] });
          return;
        }

        // Any new chat message — even one we sent ourselves — should refresh
        // the conversation-list preview so the "last message" snippet stays
        // current. Without this the card on the left keeps showing whatever
        // message was there when the page first loaded.
        if (data.id && data.content) {
          queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
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
  }, [streamUrl, addNotification, closeConnection, showDesktopNotification, queryClient]);

  return { closeConnection };
}
